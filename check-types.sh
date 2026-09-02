#!/bin/bash
cd /Users/devonclarke/DonsRental/frontend
./node_modules/.bin/tsc --noEmit 2>&1 | head -80
