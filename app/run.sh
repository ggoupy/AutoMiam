# Starts server
gnome-terminal --window-with-profile=gasa -- bash -c 'cd dog-identifier && python3 server.py'

# Exposes thing
gnome-terminal --window-with-profile=gasa -- bash -c 'cd pet-feeder/thing && npm run start'

# Starts controller
gnome-terminal --window-with-profile=gasa -- bash -c "sleep 4 && cd pet-feeder/controller && npm run start"

# Starts UI
gnome-terminal --window-with-profile=gasa -- bash -c "cd ui && python3 -m http.server 2022"
