AFRAME.registerComponent('proximity-sensor', {
    init: function() {
        this.camera = document.querySelector('#camera');
        this.textElement = document.querySelector('#proximity-text');
        this.sphere = document.querySelector('#target-sphere');
        this.isInRange = false;
        this.moveSpeed = 0.1;
        this.controlsEnabled = false;
        this.wasInRange = false;

        // Add new audio properties for thruster sound
        this.audioCtx = null;
        this.thrusterSoundBuffer = null;
        this.thrusterSoundSource = null;
        this.thrusterGainNode = null;

        // Add new properties for smooth camera movement
        this.cameraVelocity = 0;
        this.acceleration = 0.01;
        this.maxVelocity = 0.1;
        this.friction = 0.95;
        this.keys = {
            q: false,
            e: false
        };

        // Add touch control state
        this.touchControls = {
            up: false,
            down: false
        };

        // Modify touch controls setup
        this.wasdControls = {
            w: false,
            a: false,
            s: false,
            d: false
        };

        // Setup touch controls
        this.setupTouchControls();
        
        // Setup audio
        this.initAudio();

        // Add initialization for acceleration properties
        this.currentAcceleration = 50;
        this.targetAcceleration = 50;
        this.accelerationRate = 10;
        this.activationTime = 0;

        // Add velocity calculation properties
        this.lastPosition = new THREE.Vector3();
        this.currentVelocity = 0;
        this.lastUpdateTime = performance.now();
        this.velocityBuffer = []; // Add buffer for smoothing
        this.bufferSize = 5; // Number of samples to average

        // Add separate velocity tracking for horizontal and vertical movement
        this.horizontalVelocityBuffer = [];
        this.verticalVelocityBuffer = [];
        this.lastHeight = 0;

        // Setup keyboard listeners
        document.addEventListener('keydown', (event) => {
            const key = event.key.toLowerCase();
            if (key === 'q') {
                this.keys.q = true;
            } else if (key === 'e') {
                this.keys.e = true;
            }
            if (this.wasdControls.hasOwnProperty(key)) {
                this.wasdControls[key] = true;
            }
        });
        
        document.addEventListener('keyup', (event) => {
            const key = event.key.toLowerCase();
            if (key === 'q') {
                this.keys.q = false;
            } else if (key === 'e') {
                this.keys.e = false;
            }
            if (this.wasdControls.hasOwnProperty(key)) {
                this.wasdControls[key] = false;
            }
        });
    },
    
    initAudio: function() {
        // User interaction is required to start AudioContext
        const startAudio = () => {
            if (this.audioCtx) return;
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            this.loadSound('thruster.MP3', (buffer) => { this.thrusterSoundBuffer = buffer; });
            document.body.removeEventListener('mousedown', startAudio);
            document.body.removeEventListener('touchstart', startAudio);
            document.body.removeEventListener('keydown', startAudio);
        };
        document.body.addEventListener('mousedown', startAudio);
        document.body.addEventListener('touchstart', startAudio);
        document.body.addEventListener('keydown', startAudio);
    },

    loadSound: function(url, callback) {
        if (!this.audioCtx) return;
        fetch(url)
            .then(response => response.arrayBuffer())
            .then(arrayBuffer => this.audioCtx.decodeAudioData(arrayBuffer))
            .then(audioBuffer => {
                callback(audioBuffer);
            })
            .catch(e => console.error(`Error loading sound: ${url}`, e));
    },

    startThrusterSound: function() {
        if (!this.audioCtx || !this.thrusterSoundBuffer || this.thrusterSoundSource) return;
        if (this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }

        this.thrusterSoundSource = this.audioCtx.createBufferSource();
        this.thrusterSoundSource.buffer = this.thrusterSoundBuffer;
        this.thrusterSoundSource.loop = true;

        this.thrusterGainNode = this.audioCtx.createGain();
        this.thrusterGainNode.gain.value = 0; // Start silent, will be updated in tick

        this.thrusterSoundSource.connect(this.thrusterGainNode);
        this.thrusterGainNode.connect(this.audioCtx.destination);
        this.thrusterSoundSource.start(0);
    },

    stopThrusterSound: function() {
        if (this.thrusterSoundSource) {
            this.thrusterSoundSource.stop();
            this.thrusterSoundSource = null;
            this.thrusterGainNode = null;
        }
    },

    shootProjectile: function() {
        // This function is no longer needed as the projectile system handles its own shooting logic.
    },
    
    setupTouchControls: function() {
        // WASD controls
        const wasdButtons = ['w', 'a', 's', 'd'];
        wasdButtons.forEach(key => {
            const btn = document.getElementById(`${key}-btn`);

            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.wasdControls[key] = true;
                // Create fake keydown event
                const keyEvent = new KeyboardEvent('keydown', {
                    key: key,
                    code: 'Key' + key.toUpperCase(),
                    keyCode: key.charCodeAt(0),
                    which: key.charCodeAt(0),
                    bubbles: true
                });
                window.dispatchEvent(keyEvent);
            });

            btn.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.wasdControls[key] = false;
                // Create fake keyup event
                const keyEvent = new KeyboardEvent('keyup', {
                    key: key,
                    code: 'Key' + key.toUpperCase(),
                    keyCode: key.charCodeAt(0),
                    which: key.charCodeAt(0),
                    bubbles: true
                });
                window.dispatchEvent(keyEvent);
            });
        });

        // Elevation controls (Q/E equivalent)
        const upBtn = document.getElementById('up-btn');
        const downBtn = document.getElementById('down-btn');

        const touchStart = (btn, control) => {
            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                if (this.controlsEnabled) {
                    this.touchControls[control] = true;
                }
                btn.style.backgroundColor = 'rgba(255, 255, 255, 0.5)';
            });
        };

        const touchEnd = (btn, control) => {
            btn.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.touchControls[control] = false;
                btn.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
            });

            // Add touchcancel handling
            btn.addEventListener('touchcancel', (e) => {
                e.preventDefault();
                this.touchControls[control] = false;
                btn.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
            });
        };

        touchStart(upBtn, 'up');
        touchEnd(upBtn, 'up');
        touchStart(downBtn, 'down');
        touchEnd(downBtn, 'down');
    },

    tick: function() {
        // Get the camera rig's world position
        const cameraRig = this.camera.parentElement;
        const currentPosition = new THREE.Vector3();
        cameraRig.object3D.getWorldPosition(currentPosition);
        
        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastUpdateTime) / 1000; // Convert to seconds
        
        // Calculate distance to suit
        const distanceToSuit = this.camera.object3D.position.distanceTo(this.sphere.object3D.position);
        
        if (deltaTime > 0) {  // Prevent division by zero
            // Calculate horizontal velocity using distance to suit
            const horizontalDistance = Math.abs(distanceToSuit - this.lastDistance);
            
            // Calculate vertical distance moved
            const verticalDistance = Math.abs(currentPosition.y - this.lastPosition.y);
            
            // Calculate instantaneous velocities
            const instantHorizontalVelocity = horizontalDistance / deltaTime;
            const instantVerticalVelocity = verticalDistance / deltaTime;
            
            // Add to buffers
            this.horizontalVelocityBuffer.push(instantHorizontalVelocity);
            this.verticalVelocityBuffer.push(instantVerticalVelocity);
            
            // Keep buffer size limited
            if (this.horizontalVelocityBuffer.length > this.bufferSize) {
                this.horizontalVelocityBuffer.shift();
            }
            if (this.verticalVelocityBuffer.length > this.bufferSize) {
                this.verticalVelocityBuffer.shift();
            }
            
            // Calculate average velocities using the last 3 values for smoother results
            const recentHorizontalValues = this.horizontalVelocityBuffer.slice(-3);
            const recentVerticalValues = this.verticalVelocityBuffer.slice(-3);
            
            const horizontalVelocity = recentHorizontalValues.reduce((a, b) => a + b, 0) / recentHorizontalValues.length;
            const verticalVelocity = recentVerticalValues.reduce((a, b) => a + b, 0) / recentVerticalValues.length;
            
            // Calculate total velocity
            this.currentVelocity = Math.sqrt(Math.pow(horizontalVelocity, 2) + Math.pow(verticalVelocity, 2));
        }
        
        // Store last distance for next frame
        this.lastDistance = distanceToSuit;
        
        // Update last position and time for next frame
        this.lastPosition.copy(currentPosition);
        this.lastUpdateTime = currentTime;

        const distance = this.camera.object3D.position.distanceTo(this.sphere.object3D.position);
        const heightDiff = Math.abs(cameraRig.getAttribute('position').y - this.sphere.object3D.position.y);
        
        // Check both horizontal distance AND height difference
        const inRange = distance < 4 && heightDiff < 3;

        // Time-based acceleration logic
        if (this.controlsEnabled && Object.values(this.wasdControls).some(value => value)) {
            const now = Date.now();
            if (this.activationTime === 0) {
                this.activationTime = now;
            }
            
            const timeActive = (now - this.activationTime) / 1000; // Convert to seconds
            
            // Set target acceleration based on time active
            if (timeActive <= 4) {
                this.targetAcceleration = 50;
            } else if (timeActive <= 6) {
                this.targetAcceleration = 250;
            } else if (timeActive <= 10) {
                this.targetAcceleration = 500;
            } else {
                this.targetAcceleration = 1900;
            }
        } else {
            this.targetAcceleration = 50;
            this.activationTime = 0;
        }

        // Smooth acceleration transition
        const delta = this.targetAcceleration - this.currentAcceleration;
        if (Math.abs(delta) > this.accelerationRate) {
            this.currentAcceleration += Math.sign(delta) * this.accelerationRate;
        } else {
            this.currentAcceleration = this.targetAcceleration;
        }

        // Update WASD controls acceleration
        this.camera.setAttribute('wasd-controls', `acceleration: ${this.currentAcceleration}`);

        // Add null checks before updating HUD elements
        const velocityInfo = document.querySelector('.velocidad-info');
        if (velocityInfo) {
            const totalVelKmh = Math.round((this.currentVelocity * 3.6) * 10) / 10;
            velocityInfo.textContent = `${Math.round(totalVelKmh)} km/h | ${Math.round(this.currentVelocity * 10) / 10} m/s`;
        }

        // Update altitude scale with arrow and proper scaling (inverted)
        const altitudoEscala = document.querySelector('.altitud-escala');
        if (altitudoEscala) {
            // Clear previous marks
            altitudoEscala.innerHTML = '';
            
            // Get current height in meters
            const heightMeters = this.camera.parentElement.getAttribute('position').y;
            
            // Calculate range to show (±500m from current height)
            const range = 500; // meters above and below current height
            const minHeight = Math.max(0, heightMeters - range);
            const maxHeight = heightMeters + range;
            
            // Add marks from top to bottom
            for (let h = maxHeight; h >= minHeight; h -= 100) {
                // Calculate percentage position
                // Current height should always be at 50%
                const percentage = 50 + ((heightMeters - h) / (range * 2)) * 100;
                
                // Add special marker for current height (always at 50%)
                if (Math.abs(h - heightMeters) < 50) {
                    altitudoEscala.innerHTML += `
                        <div class="altitud-marca" style="top:50%; width:30px; background-color:#00ffff;">
                            <span style="position:absolute; left:-15px; top:-5px;">➤</span>
                        </div>
                        <div class="altitud-texto" style="top:50%; color:#00ffff; font-weight:bold;">
                            ${(h/1000).toFixed(2)}km | ${Math.round(h)}m | ${Math.round(h * 3.28084)}ft
                        </div>
                    `;
                } else {
                    altitudoEscala.innerHTML += `
                        <div class="altitud-marca" style="top:${percentage}%;"></div>
                        <div class="altitud-texto" style="top:${percentage}%;">
                            ${(h/1000).toFixed(2)}km
                        </div>
                    `;
                }
            }
        }

        // Update compass with 20-degree increments
        const brujulaFija = document.querySelector('.brujula-fija');
        if (brujulaFija) {
            brujulaFija.innerHTML = '';
            
            // Get camera rotation in degrees and adjust for correct cardinal directions
            // When looking forward (Z-), heading should be 0° (North)
            // When looking right (X+), heading should be 90° (East)
            // When looking back (Z+), heading should be 180° (South)
            // When looking left (X-), heading should be 270° (West)
            const rotation = THREE.MathUtils.radToDeg(this.camera.object3D.rotation.y);
            const heading = (450 - rotation) % 360; // Add 450 and mod 360 to get correct cardinal orientation
            
            // Create ticks and labels every 20 degrees
            for (let deg = 0; deg < 360; deg += 20) {
                const adjustedDeg = (deg + heading) % 360;
                const position = (deg / 360) * 100;
                
                // Add tick
                const tick = document.createElement('div');
                tick.className = 'brujula-tick';
                tick.style.left = `${position}%`;
                brujulaFija.appendChild(tick);
                
                // Add label every 20 degrees
                const label = document.createElement('div');
                label.className = 'brujula-label';
                label.style.left = `${position}%`;
                label.textContent = `${Math.round(adjustedDeg)}°`;
                
                // Add cardinal point labels
                let cardinalPoint = '';
                if (adjustedDeg === 0) cardinalPoint = ' N';
                else if (adjustedDeg === 90) cardinalPoint = ' E';
                else if (adjustedDeg === 180) cardinalPoint = ' S';
                else if (adjustedDeg === 270) cardinalPoint = ' W';
                
                label.textContent = `${Math.round(adjustedDeg)}°${cardinalPoint}`;
                
                if (adjustedDeg % 90 === 0) { // Highlight cardinal points
                    label.style.color = '#00ffff';
                    label.style.fontWeight = 'bold';
                }
                brujulaFija.appendChild(label);
            }
        }

        // Add smooth camera movement logic
        if (this.controlsEnabled) {
            if (this.keys.q || this.touchControls.up) {
                this.cameraVelocity = Math.min(this.cameraVelocity + this.acceleration, this.maxVelocity);
            } else if (this.keys.e || this.touchControls.down) {
                this.cameraVelocity = Math.max(this.cameraVelocity - this.acceleration, -this.maxVelocity);
            } else {
                this.cameraVelocity *= this.friction;
            }

            // Apply velocity to camera position
            if (Math.abs(this.cameraVelocity) > 0.0001) {
                const cameraRig = this.camera.parentElement;
                const currentY = cameraRig.getAttribute('position').y;
                const newY = Math.max(1.97, currentY + this.cameraVelocity); // Minimum height of 1.97
                cameraRig.setAttribute('position', {
                    x: cameraRig.getAttribute('position').x,
                    y: newY,
                    z: cameraRig.getAttribute('position').z
                });
            }

            // Update thruster sound volume
            if (this.thrusterGainNode) {
                const maxSpeedKmh = 1240;
                const maxSpeedMs = maxSpeedKmh / 3.6; // ~344.44 m/s
                
                // Calculate speed ratio relative to the speed where sound should be minimal
                const speedRatio = Math.min(this.currentVelocity / maxSpeedMs, 1.0);
                
                // Volume decreases as speed increases. Max volume 0.4, min volume near 0.
                const volume = (1.0 - speedRatio) * 0.4;
                this.thrusterGainNode.gain.setValueAtTime(volume, this.audioCtx.currentTime);
            }
        }

        // Toggle controls when entering range
        if (inRange && !this.wasInRange) {
            this.controlsEnabled = !this.controlsEnabled;
            // Reset velocity when toggling controls
            this.cameraVelocity = 0;
            // Toggle thruster sound
            if (this.controlsEnabled) {
                this.startThrusterSound();
            } else {
                this.stopThrusterSound();
            }
        }

        // Only update proximity text when needed
        if (inRange) {
            if (this.textElement) {
                const distanceText = Math.round(distance * 10) / 10;
                const controlStatus = this.controlsEnabled ? "ACTIVADOS" : "DESACTIVADOS";
                this.textElement.setAttribute('value',
                    `¡Estás cerca! Distancia: ${distanceText} metros\n` +
                    `Controles Q/E: ${controlStatus}`);
                this.textElement.setAttribute('visible', true);
            }
        } else if (this.textElement) {
            this.textElement.setAttribute('visible', false);
        }

        this.wasInRange = inRange;
    }
});
