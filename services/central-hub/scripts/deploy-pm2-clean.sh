#!/bin/bash
# deploy-pm2-clean.sh - Script de deployment limpio con PM2

set -e  # Exit on error

echo "==========================================="
echo "  LeadMaster - Clean PM2 Deployment"
echo "==========================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Stop all processes
echo -e "${YELLOW}[1/8] Stopping all processes...${NC}"
pm2 delete all 2>/dev/null || echo "No PM2 processes to delete"
killall -9 node 2>/dev/null || echo "No Node.js processes to kill"
sleep 2

# Step 2: Verify ports are free
echo -e "${YELLOW}[2/8] Verifying ports...${NC}"
if lsof -i :3012 > /dev/null 2>&1; then
  echo -e "${RED}Error: Port 3012 is still in use${NC}"
  lsof -i :3012
  exit 1
fi

if lsof -i :3001 > /dev/null 2>&1; then
  echo -e "${RED}Error: Port 3001 is still in use${NC}"
  lsof -i :3001
  exit 1
fi

echo -e "${GREEN}✓ Ports 3012 and 3001 are free${NC}"

# Step 3: Clean PM2
echo -e "${YELLOW}[3/8] Cleaning PM2...${NC}"
pm2 kill
pm2 cleardump
rm -rf /root/.pm2/logs/*.log
echo -e "${GREEN}✓ PM2 cleaned${NC}"

# Step 4: Navigate to project
echo -e "${YELLOW}[4/8] Navigating to project...${NC}"
cd /root/leadmaster-workspace/services/central-hub

# Step 5: Start with ecosystem
echo -e "${YELLOW}[5/8] Starting Central Hub with PM2...${NC}"
pm2 start ecosystem.config.js

# Step 6: Wait and verify
echo -e "${YELLOW}[6/8] Waiting 15 seconds for initialization...${NC}"
sleep 15

# Step 7: Check health
echo -e "${YELLOW}[7/8] Checking health endpoints...${NC}"

if curl -s http://localhost:3012/health | grep -q "healthy"; then
  echo -e "${GREEN}✓ Central Hub is healthy${NC}"
else
  echo -e "${RED}✗ Central Hub health check failed${NC}"
  pm2 logs --lines 50 --nostream
  exit 1
fi

# Step 8: Save configuration
echo -e "${YELLOW}[8/8] Saving PM2 configuration...${NC}"
pm2 save

echo ""
echo "==========================================="
echo -e "${GREEN}  Deployment Complete!${NC}"
echo "==========================================="
echo ""
echo "PM2 Status:"
pm2 list

echo ""
echo "Logs (last 20 lines):"
pm2 logs --lines 20 --nostream

echo ""
echo "Next steps:"
echo "  - Monitor logs: pm2 logs"
echo "  - Setup auto-start: pm2 startup"
echo "  - View dashboard: pm2 monit"
echo ""
