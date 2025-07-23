AFRAME.registerComponent('projectile-system', {
    init: function() {
        this.projectiles = [];
        this.maxProjectiles = 1;
        this.shootCooldown = 200; // milliseconds
        this.lastShootTime = 0;
        
        // Audio properties
        this.audioCtx = null;
        this.chargeSoundBuffer = null;
        this.shootSoundBuffer = null;
        this.chargeSoundSource = null;

        // Charge system properties
        this.isCharging = false;
        this.chargeStartTime = 0;
        this.chargeLevel = 0;
        this.minChargeTime = 1000; // 1 second minimum for any shot
        this.dualShotTime = 1000; // 3-5.99 seconds for dual shot
        this.normalShotTime = 2000; // 6+ seconds for normal shot
        
        // Keyboard controls
        this.keys = { z: false };
        
        // UI element for weapon status
        this.weaponStatusEl = document.getElementById('weapon-status');
        
        // Initialize Audio
        this.initAudio();

        // Setup keyboard listeners
        document.addEventListener('keydown', (event) => {
            const key = event.key.toLowerCase();
            if (key === 'z' && !this.keys.z) {
                this.keys.z = true;
                this.startCharging();
            }
        });
        
        document.addEventListener('keyup', (event) => {
            const key = event.key.toLowerCase();
            if (key === 'z') {
                this.keys.z = false;
                this.releaseCharging();
            }
        });
        
        // Touch controls for shoot button
        const shootBtn = document.getElementById('shoot-btn');
        if (shootBtn) {
            shootBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                if (!this.isCharging) {
                    this.startCharging();
                }
                shootBtn.style.transform = 'scale(0.9)';
                shootBtn.style.backgroundColor = 'rgba(255, 100, 100, 0.6)';
            });
            
            shootBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.releaseCharging();
                shootBtn.style.transform = 'scale(1)';
                shootBtn.style.backgroundColor = 'linear-gradient(145deg, rgba(255, 0, 100, 0.3), rgba(255, 0, 50, 0.4))';
            });
            
            shootBtn.addEventListener('contextmenu', (e) => e.preventDefault());
        }
    },
    
    initAudio: function() {
        // User interaction is required to start AudioContext
        const startAudio = () => {
            if (this.audioCtx) return;
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            this.loadSound('charge.mp3', (buffer) => { this.chargeSoundBuffer = buffer; });
            this.loadSound('shoot.mp3', (buffer) => { this.shootSoundBuffer = buffer; });
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

    playSound: function(buffer) {
        if (!buffer || !this.audioCtx || this.audioCtx.state === 'suspended') return;
        const source = this.audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(this.audioCtx.destination);
        source.start(0);
    },

    startCharging: function() {
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
        this.chargeStartTime = Date.now();
        this.isCharging = true;
        
        if (this.chargeSoundBuffer && !this.chargeSoundSource) {
            this.chargeSoundSource = this.audioCtx.createBufferSource();
            this.chargeSoundSource.buffer = this.chargeSoundBuffer;
            this.chargeSoundSource.loop = true;
            this.chargeSoundSource.playbackRate.value = 0.5; // Start with a low pitch
            this.chargeSoundSource.connect(this.audioCtx.destination);
            this.chargeSoundSource.start(0);
        }

        // Update shoot button to show charging state
        const shootBtn = document.getElementById('shoot-btn');
        if (shootBtn) {
            shootBtn.textContent = 'CHARGING...';
        }
        if (this.weaponStatusEl) {
            this.weaponStatusEl.textContent = 'CHARGING...';
        }
            
        // Start charge animation
        this.chargeInterval = setInterval(() => {
            const elapsed = Date.now() - this.chargeStartTime;

            // Update pitch based on charge time
            if (this.chargeSoundSource) {
                // Ramp playbackRate from 0.5 to 2.0 over the course of `normalShotTime`
                const chargeProgress = Math.min(elapsed / this.normalShotTime, 1.0);
                const newPlaybackRate = 0.5 + (chargeProgress * 1.5);
                this.chargeSoundSource.playbackRate.value = newPlaybackRate;
            }
                
            // Update button appearance based on charge time
            let chargeText = 'CHARGING...';
            let statusText = 'CHARGING...';

            if (elapsed >= this.normalShotTime) {
                chargeText = 'NORMAL READY';
                statusText = 'NORMAL SHOT';
            } else if (elapsed >= this.dualShotTime) {
                chargeText = 'DUAL READY';
                statusText = 'DUAL SHOT';
            }
                
            if (shootBtn) shootBtn.textContent = chargeText;
            if (this.weaponStatusEl) this.weaponStatusEl.textContent = `ARMED: ${statusText}`;

            // Update glow effect
            const intensity = Math.min((elapsed / this.normalShotTime) * 100, 100);
            if (shootBtn) shootBtn.style.boxShadow = `0 0 ${15 + intensity/2}px rgba(255, 100, 100, ${0.3 + (elapsed/this.normalShotTime) * 0.5})`;
        }, 100);
    },
    
    releaseCharging: function() {
        if (!this.isCharging) return;
        
        if (this.chargeSoundSource) {
            this.chargeSoundSource.stop();
            this.chargeSoundSource = null;
        }

        const elapsed = Date.now() - this.chargeStartTime;
        this.isCharging = false;
        
        if (this.chargeInterval) {
            clearInterval(this.chargeInterval);
            this.chargeInterval = null;
        }
        
        // Reset button appearance
        const shootBtn = document.getElementById('shoot-btn');
        if (shootBtn) {
            shootBtn.textContent = 'Z';
            shootBtn.style.boxShadow = '0 0 10px rgba(255, 100, 100, 0.3)';
            shootBtn.style.background = 'linear-gradient(145deg, rgba(255, 0, 100, 0.3), rgba(255, 0, 50, 0.4))';
        }
        
        // Determine shot based on charge time
        if (elapsed < this.minChargeTime) {
            // Less than 1 second - no shot
            if (shootBtn) {
                shootBtn.textContent = 'NO SHOT';
                setTimeout(() => {
                    shootBtn.textContent = 'Z';
                }, 1000);
            }
            if(this.weaponStatusEl) {
                this.weaponStatusEl.textContent = 'SHOT FAILED';
                setTimeout(() => {
                    this.weaponStatusEl.textContent = 'WEAPON: STANDBY';
                }, 1000);
            }
        } else if (elapsed >= this.normalShotTime) {
            // 6+ seconds - single normal shot
            this.shoot(0, 0);
            if (shootBtn) {
                shootBtn.textContent = 'NORMAL';
                setTimeout(() => {
                    shootBtn.textContent = 'Z';
                }, 1000);
            }
             if(this.weaponStatusEl) {
                this.weaponStatusEl.textContent = 'NORMAL FIRED';
                setTimeout(() => {
                    this.weaponStatusEl.textContent = 'WEAPON: STANDBY';
                }, 1000);
            }
        } else if (elapsed >= this.dualShotTime) {
            // 3-5.99 seconds - dual alternating shots
            const offset = 2.5;
            this.shoot(-offset, 0); // Left shot
            setTimeout(() => {
                this.shoot(offset, 0); // Right shot
            }, 100);

            if (shootBtn) {
                shootBtn.textContent = 'DUAL';
                setTimeout(() => {
                    shootBtn.textContent = 'Z';
                }, 1000);
            }
            if(this.weaponStatusEl) {
                this.weaponStatusEl.textContent = 'DUAL FIRED';
                setTimeout(() => {
                    this.weaponStatusEl.textContent = 'WEAPON: STANDBY';
                }, 1000);
            }
        }
        
        // Reset charge level
        this.chargeLevel = 0;
    },
    
    shoot: function(xOffset = 0, yOffset = 0) {
        this.playSound(this.shootSoundBuffer);
        const now = Date.now();
        // The cooldown check is now implicitly handled by the charging mechanism,
        // but we can keep a simplified version for the dual shot.
        if (xOffset !== 0) { // Part of a dual shot, no cooldown check
             this.lastShootTime = now;
             this.createProjectile(xOffset, yOffset);
             return;
        }

        // For single shots, check cooldown.
        if (now - this.lastShootTime < this.shootCooldown) return;
        
        this.lastShootTime = now;
        this.createProjectile(xOffset, yOffset);
    },
    
    createProjectile: function(xOffset = 0, yOffset = 0) {
        const camera = document.querySelector('#camera');
        
        // Create projectile entity - vertical cylinder
        const projectile = document.createElement('a-cylinder');
        projectile.setAttribute('radius', '0.15');
        projectile.setAttribute('height', '125');
        projectile.setAttribute('color', '#ffe282');
        projectile.setAttribute('material', {
            emissive: '#fffae8',
            emissiveIntensity: 1,
            metalness: 0.8,
            roughness: 0.2
        });
        
        // Position projectile at camera position
        const worldPos = new THREE.Vector3();
        camera.object3D.getWorldPosition(worldPos);
        
        // Calculate direction based on camera orientation
        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyQuaternion(camera.object3D.quaternion);
        
        // Position projectile with offset
        const startPos = {
            x: worldPos.x + direction.x * 0.1 + xOffset,
            y: worldPos.y + direction.y * 0.1 + yOffset,
            z: worldPos.z + direction.z * 0.1
        };
        
        projectile.setAttribute('position', startPos);
        
        // Set rotation to be perpendicular to camera (vertical)
        projectile.object3D.rotation.copy(camera.object3D.rotation);
        projectile.object3D.rotateX(Math.PI / 2);
        
        // Add glow effect
        const glow = document.createElement('a-light');
        glow.setAttribute('type', 'point');
        glow.setAttribute('color', '#ffe282');
        glow.setAttribute('intensity', 2);
        glow.setAttribute('distance', 1.5);
        projectile.appendChild(glow);
        
        // Calculate end position
        const velocity = 150;
        const duration = 1000;
        const endPosition = {
            x: startPos.x + (direction.x * velocity),
            y: startPos.y + (direction.y * velocity),
            z: startPos.z + (direction.z * velocity)
        };
        
        // Apply animation for movement
        projectile.setAttribute('animation', {
            property: 'position',
            to: endPosition,
            dur: duration,
            easing: 'linear'
        });
        
        document.querySelector('a-scene').appendChild(projectile);
        
        // Add to projectiles array and manage count
        this.projectiles.push(projectile);
        if (this.projectiles.length > this.maxProjectiles) {
            const oldProjectile = this.projectiles.shift();
            if (oldProjectile.parentNode) {
                oldProjectile.parentNode.removeChild(oldProjectile);
            }
        }
        
        // Auto-cleanup after animation
        setTimeout(() => {
            const index = this.projectiles.indexOf(projectile);
            if (index > -1) {
                this.projectiles.splice(index, 1);
            }
            if (projectile.parentNode) {
                projectile.parentNode.removeChild(projectile);
            }
        }, duration + 100);
    }
});
