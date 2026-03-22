module.exports = {
  apps: [
    {
      name: "mcp-readonly-http",
      script: "dist/http.js",
      cwd: "/root/leadmaster-workspace/services/central-hub/mcp-readonly",
      env: {
        PORT: "3011",
        ALLOWED_HOSTS: "localhost,127.0.0.1,mcp.desarrolloydisenioweb.com.ar"
      }
    }
  ]
};
