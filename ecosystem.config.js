module.exports = {
  apps : [
    {
      name: "st-manager",
      script: "server.js",
      env: {
        "NODE_ENV": "production",
      }
    },
    {
      name: "st-forward",
      script: "forward-server.js",
      env: {
        "NODE_ENV": "production",
      }
    }
  ]
}
