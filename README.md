# PM2 module: Process Watchdog

Module is continuously checking the health of PM2 NodeJS processes by passing the out log and err log to check script. If the check script exit with code is not 0, the PM2 process will be restarted.

## Installation

```bash
pm2 install @oraichain/pm2-watchdog
```

## Basic configuration

```bash
# Enable watching for PM2_PROCESS_NAME. Module will continuously checks the availability of URL.
pm2 set pm2-watchdog:PM2_PROCESS_NAME SCRIPT.js

```

Example:

```bash
# start a pm2 process with name test
pm2 start examples/test.js --name test

# assign watch dog checking script
pm2 set pm2-watchdog:test $PWD/examples/check.js
```

## Optional advanced configuration

```bash
# Set the checking for every NUMBER seconds.
# Default is 3 seconds (if no value is specified).
pm2 set pm2-watchdog:PM2_PROCESS_NAME/checking_interval NUMBER

# Set the app restart when NUMBER checks had failed in a row.
# Default is 3 times (if no value is specified).
pm2 set pm2-watchdog:PM2_PROCESS_NAME/fails_to_restart NUMBER

# Enable message output level.
# Note: Log files are `~/.pm2/logs/pm2-watchdog-out.log`
#                 and `~/.pm2/logs/pm2-watchdog-error.log`
# Default is `info` (if no value is specified).
# Possible values (levels):
#   `info`  - info messages only (default)
#   `debug` - info + debug messages
#   `trace` - info + debug + trace messages
pm2 set pm2-watchdog:debug LEVEL
```

## Logging

The processes restarts are logged to error log file (to error output).
Therefore if you are tracking errors of your applications, you can redirect the error messages to get complete overview what is happening in your server.
The log output is buffering and pass to checking script every checking_interval, including both err log file and out log file.
