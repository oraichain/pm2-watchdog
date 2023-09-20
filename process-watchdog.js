'use strict';

// Dependencies
const fs = require('fs');
const pm2 = require('pm2');
const { execFileSync } = require('child_process');

/**
 * Checks the process of specified PM2 process and restart it when no response or error.
 */
class ProcessWatchdog {
  /**
   * @param {pm2.ProcessDescription} pm2Env
   * @param {WatchdogOptions} options
   */
  constructor(pm2Env, options) {
    /** @type {string} */
    this.pm_id = pm2Env.pm_id;

    /** @type {string} */
    this.name = pm2Env.name;

    /** @type {boolean} */
    this.isRunning = false;

    /** @type {WatchdogOptions} */
    this.options = options;

    /** @type {function} */
    this.timeoutId = null;

    /** @type {number} */
    this.failsCountInRow = 0;

    this.outLog = {
      path: pm2Env.pm2_env.pm_out_log_path,
      ind: fs.statSync(pm2Env.pm2_env.pm_out_log_path).size
    };

    this.errLog = {
      path: pm2Env.pm2_env.pm_err_log_path,
      ind: fs.statSync(pm2Env.pm2_env.pm_err_log_path).size
    };
  }

  /**
   * Run/Restart the process.
   */
  start() {
    if (this.isRunning) {
      console.trace(`Process ${this.name} - cannot start watchdog, because it is already running`);
      return;
    }

    console.info(`Process ${this.name} - starting watching ${this.options.processScript}`);

    this.isRunning = true;
    this.failsCountInRow = 0;

    this.healthCheckingLoop();
  }

  /**
   * Stop the process checking.
   */
  stop() {
    if (!this.isRunning) {
      console.trace(`Process ${this.name} - Cannot stop watchdog, because it is not running`);
      return;
    }

    console.info(`Process ${this.name} - stopping watchdog`);

    this.isRunning = false;

    if (this.timeoutId) {
      console.trace(`Process ${this.name} - Removing existing planned checking`);
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  /**
   * @return {Promise<pm2.ProcessDescription>} - Details of process
   */
  getProcessDetails() {
    console.trace(`Process ${this.name} - getting process details`);
    return new Promise((resolve, reject) => {
      pm2.describe(this.pm_id, (err, processDescription) => {
        if (err) {
          return reject(err);
        }
        if (processDescription.length !== 1) {
          return reject(new Error(`Process ${this.name} - details receiving failed. Unexpected number of results (${processDescription.length})`));
        }
        resolve(processDescription[0]);
      });
    });
  }

  /**
   * Internal function for continuously checking the process and restarting the PM2 process.
   */
  healthCheckingLoop() {
    if (!this.isRunning) {
      return;
    }

    // Get uptime to count uptime
    this.getProcessDetails()
      .then(
        /**@param {pm2.ProcessDescription} processDescription*/ (processDescription) => {
          if (!this.isRunning) {
            return;
          }

          // Calculate time, when to execute the process check.
          const processUptime = new Date().getTime() - processDescription.pm2_env.created_at;
          const minUptime = typeof processDescription.pm2_env.min_uptime !== 'undefined' ? processDescription.pm2_env.min_uptime : 1000;
          const executeWatchdogAfter = Math.max(minUptime - processUptime, this.options.checkingInterval, 1000);
          console.trace(`Process ${this.name} - next checking after ${(executeWatchdogAfter / 1000).toFixed(0)}s`);

          // Plan the next execution
          this.timeoutId = setTimeout(() => {
            this.timeoutId = null;

            if (!this.isRunning) {
              return;
            }

            console.trace(`Process ${this.name} - checking executed timeout ${this.options.checkingInterval}`);

            const newOutLogInd = fs.statSync(this.outLog.path).size;
            const newErrLogInd = fs.statSync(this.errLog.path).size;

            try {
              // pass outLog:start:stop errLog:start:stop to script
              const ret = execFileSync('node', [this.options.processScript, `${this.outLog.path}:${this.outLog.ind}:${newOutLogInd}`, `${this.errLog.path}:${this.errLog.ind}:${newErrLogInd}`]);
              // console.info('return', ret.toString());
              this.failsCountInRow = 0;
              console.debug(`Process ${this.name} - ok`);
            } catch (ex) {
              console.error(ex);
              if (!this.isRunning) {
                return;
              }

              this.failsCountInRow++;
              if (this.failsCountInRow < this.options.failsToRestart) {
                console.info(`Process ${this.name} - ${this.failsCountInRow}/${this.options.failsToRestart} failed`);
                return;
              }

              const m = `Process ${this.name} - restarting because not ok`;
              console.error(m);

              // Process restart
              return new Promise((resolve, reject) => {
                pm2.restart(this.pm_id, (err) => {
                  if (err) {
                    console.error(`Process ${this.name} - restart failed. ${err.message || err}`);
                    reject(err);
                    return;
                  }
                  this.failsCountInRow = 0;
                  resolve();
                });
              });
            } finally {
              // update current ind
              this.outLog.ind = newOutLogInd;
              this.errLog.ind = newErrLogInd;
              this.healthCheckingLoop();
            }
          }, executeWatchdogAfter);
        }
      )
      .catch((err) => {
        // Getting uptime failed.
        console.error(`Failed to receive of process details. ${err.message || err}`);
        if (!this.timeoutId) {
          setTimeout(() => {
            this.healthCheckingLoop();
          }, 5000);
        }
      });
  }
}

module.exports = ProcessWatchdog;

/**
 * @typedef {object} WatchdogOptions
 * @property {string} processScript
 * @property {number} checkingInterval
 * @property {number} failsToRestart
 */
