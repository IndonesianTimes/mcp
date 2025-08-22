// PM2 ecosystem for MCP + KB watcher (CommonJS)
module.exports = {
  apps: [
    {
      name: "mcp",
      script: "./server.js",
      cwd: __dirname,
      env: {
        NODE_ENV: "development",
        PORT: 3000,
        TRUST_PROXY: 1
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 3000,
        TRUST_PROXY: 1
      },
      out_file: "./logs/mcp-out.log",
      error_file: "./logs/mcp-error.log",
      time: true,
      max_restarts: 10
    },
    {
      name: "kb-watcher",
      script: "./watcher.sh",
      cwd: __dirname,
      interpreter: "bash",
      out_file: "./logs/watcher-out.log",
      error_file: "./logs/watcher-error.log",
      time: true,
      restart_delay: 2000,
      env: {
        NODE_ENV: "production"
      }
    }
  ]
}
