# shipit-cli-mjs

Modern ESM CLI tool for deployment and server automation.

## Installation

```bash
# Global
npm install -g shipit-cli-mjs

# Or local (recommended)
npm install --save-dev shipit-cli-mjs
```

## Usage

```
Usage: shipit <environment> <tasks...>

Options:
  -V, --version           output the version number
  --shipitfile <file>    Specify a custom shipitfile to use
  --require <files...>   Script required before launching Shipit
  --tasks                List available tasks
  --environments         List available environments
  -h, --help             output usage information
```

## shipitfile.mjs

Create a `shipitfile.mjs` in your project root:

```javascript
export default shipit => {
  shipit.initConfig({
    default: {
      key: './ssh/id_rsa',
    },
    staging: {
      servers: 'deploy@staging.example.com',
    },
    production: {
      servers: ['deploy@prod1.example.com', 'deploy@prod2.example.com'],
    },
  })

  shipit.task('deploy', async () => {
    await shipit.remote('cd /var/www/myapp && git pull')
  })

  shipit.task('hello', async () => {
    await shipit.local('echo "hello from local"')
    await shipit.remote('echo "hello from server"')
  })
}
```

## Running Commands

```bash
# Deploy to staging
shipit staging deploy

# Run hello task
shipit staging hello

# List available tasks
shipit staging --tasks

# List available environments
shipit --environments

# Use custom shipitfile
shipit staging --shipitfile deploy.mjs
```

## API

### shipit.initConfig(config)

Initialize configuration for environments:

```javascript
shipit.initConfig({
  default: {
    key: process.env.HOME + '/.ssh/id_rsa', // SSH private key path
    asUser: 'deploy', // SSH user
    strict: false, // SSH strict host checking
    ignores: ['.git', 'node_modules'], // files to ignore for copy
    rsync: ['--exclude=.git'], // rsync options
  },
  staging: {
    servers: 'deploy@staging.example.com',
  },
  production: {
    servers: ['deploy@prod1.com', 'deploy@prod2.com'],
  },
})
```

### shipit.task(name, [deps], fn)

Create a task:

```javascript
shipit.task('deploy', async () => {
  await shipit.remote('cd /var/www/myapp && git pull')
})
```

With dependencies:

```javascript
shipit.task('deploy', ['build'], async () => {
  await shipit.remote('cd /var/www/myapp && git pull')
})
```

### shipit.blTask(name, [deps], fn)

Blocking task - blocks other tasks during execution:

```javascript
shipit.blTask('db:migrate', async () => {
  await shipit.remote('npm run migrate')
})
```

### shipit.local(command, [options])

Run a local command:

```javascript
shipit.task('build', async () => {
  await shipit.local('npm run build')
})
```

### shipit.remote(command, [options])

Run a command on remote servers:

```javascript
shipit.task('check', async () => {
  const results = await shipit.remote('uptime')
  console.log(results[0].stdout)
})
```

### shipit.copyToRemote(src, dest, [options])

Copy from local to remote using rsync:

```javascript
shipit.task('deploy', async () => {
  await shipit.copyToRemote('./dist', '/var/www/myapp')
})
```

### shipit.copyFromRemote(src, dest, [options])

Copy from remote to local:

```javascript
shipit.task('download-logs', async () => {
  await shipit.copyFromRemote('/var/www/myapp/logs', './logs')
})
```

### shipit.log(...args)

Logging (same API as console.log):

```javascript
shipit.log('Deploying to %s', 'production')
```

## SSH Key Configuration

```javascript
shipit.initConfig({
  default: {
    key: process.env.HOME + '/.ssh/id_rsa',
  },
  production: {
    servers: 'deploy@production.com',
  },
})
```

## Multiple Servers

```javascript
shipit.initConfig({
  production: {
    servers: ['deploy@server1.com', 'deploy@server2.com'],
  },
})

shipit.task('restart', async () => {
  const results = await shipit.remote('systemctl restart app')
  // results[0] - server1 result
  // results[1] - server2 result
})
```

## Events

Available events:

- `init` - before initializing SSH pool
- `init:after_ssh_pool` - after SSH pool initialized
- `task_start` - task started
- `task_stop` - task finished
- `task_err` - task errored
- `task_not_found` - task not found

```javascript
shipit.on('task_start', e => {
  shipit.log(`Starting task: ${e.task}`)
})
```

## License

MIT
