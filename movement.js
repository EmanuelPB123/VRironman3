AFRAME.registerComponent('movement-tracker', {
    init: function() {
        // Movement tracking properties
        this.lastPosition = new THREE.Vector3();
        this.lastDistance = 0;
        this.lastUpdateTime = performance.now();
        
        // Velocity buffers for smoothing
        this.horizontalVelocityBuffer = [];
        this.verticalVelocityBuffer = [];
        this.bufferSize = 5;
        
        // Reference to important elements
        this.camera = document.querySelector('#camera');
        this.targetSphere = document.querySelector('#target-sphere');
        this.hudText = document.querySelector('#movement-stats');
    },
    
    tick: function() {
        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastUpdateTime) / 1000; // Convert to seconds
        
        if (deltaTime <= 0) return; // Prevent division by zero
        
        // Get current position
        const cameraRig = this.camera.parentElement;
        const currentPosition = new THREE.Vector3();
        cameraRig.object3D.getWorldPosition(currentPosition);
        
        // Calculate distance to target sphere
        const currentDistance = this.camera.object3D.position.distanceTo(this.targetSphere.object3D.position);
        
        // Calculate velocities
        const horizontalDistance = Math.abs(currentDistance - this.lastDistance);
        const verticalDistance = Math.abs(currentPosition.y - this.lastPosition.y);
        
        const instantHorizontalVelocity = horizontalDistance / deltaTime;
        const instantVerticalVelocity = verticalDistance / deltaTime;
        
        // Update buffers
        this.horizontalVelocityBuffer.push(instantHorizontalVelocity);
        this.verticalVelocityBuffer.push(instantVerticalVelocity);
        
        // Keep buffer size limited
        if (this.horizontalVelocityBuffer.length > this.bufferSize) {
            this.horizontalVelocityBuffer.shift();
        }
        if (this.verticalVelocityBuffer.length > this.bufferSize) {
            this.verticalVelocityBuffer.shift();
        }
        
        // Calculate average velocities
        const horizontalVel = this.calculateAverageVelocity(this.horizontalVelocityBuffer);
        const verticalVel = this.calculateAverageVelocity(this.verticalVelocityBuffer);
        
        // Calculate total velocity using Pythagorean theorem
        const totalVel = Math.sqrt(horizontalVel * horizontalVel + verticalVel * verticalVel);
        
        // Store current values for next frame
        this.lastPosition.copy(currentPosition);
        this.lastDistance = currentDistance;
        this.lastUpdateTime = currentTime;
        
        // Emit custom event with velocity data
        this.el.emit('velocityUpdate', {
            horizontal: horizontalVel,
            vertical: verticalVel,
            total: totalVel
        });
    },
    
    calculateAverageVelocity: function(buffer) {
        if (buffer.length === 0) return 0;
        const sum = buffer.reduce((a, b) => a + b, 0);
        return sum / buffer.length;
    }
});
