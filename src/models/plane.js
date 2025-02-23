class Airplane {
    constructor(scene) {
        // Plane properties
        this.velocity = 100;
        this.maxSpeed = 500;
        this.minSpeed = 80;
        this.acceleration = 0;
        this.accelerationRate = 200;
        this.pitch = 0;
        this.maxPitch = Math.PI / 4; // 45 degrees max pitch
        this.pitchRate = Math.PI / 3; // 60 degrees per second
        this.roll = 0;
        this.altitude = 100;
        this.verticalSpeed = 0;
        this.heading = 0;

        this.mesh = new THREE.Group();
        
        // Add shadows to all plane parts
        const addShadows = (mesh) => {
            mesh.castShadow = true;
            mesh.receiveShadow = true;
        };

        // Create fuselage
        const fuselageGeometry = new THREE.BoxGeometry(2, 2, 10);
        const fuselageMaterial = new THREE.MeshPhongMaterial({ color: 0x444444 });
        const fuselage = new THREE.Mesh(fuselageGeometry, fuselageMaterial);
        addShadows(fuselage);
        this.mesh.add(fuselage);

        // Create wings
        const wingGeometry = new THREE.BoxGeometry(12, 0.5, 3);
        const wingMaterial = new THREE.MeshPhongMaterial({ color: 0x444444 });
        const wings = new THREE.Mesh(wingGeometry, wingMaterial);
        addShadows(wings);
        this.mesh.add(wings);

        // Create tail
        const tailGeometry = new THREE.BoxGeometry(4, 2, 1);
        const tail = new THREE.Mesh(tailGeometry, wingMaterial);
        tail.position.z = -4;
        addShadows(tail);
        this.mesh.add(tail);

        this.mesh.position.y = this.altitude;
        scene.add(this.mesh);

        // Add gun properties
        this.scene = scene;
        this.bullets = [];
        this.lastShot = 0;
        this.fireRate = 0.1; // seconds between shots
    }

    shoot() {
        const now = performance.now() / 1000;
        if (now - this.lastShot < this.fireRate) return;
        
        // Get the plane's forward direction using its quaternion
        const direction = new THREE.Vector3(0, 0, 1); // Forward vector
        direction.applyQuaternion(this.mesh.quaternion);
        
        // Calculate bullet spawn position (in front of plane)
        const spawnPoint = this.mesh.position.clone();
        spawnPoint.add(direction.clone().multiplyScalar(2)); // Spawn 2 units in front
        
        // Create new bullet
        this.bullets.push(new Bullet(this.scene, spawnPoint, direction));
        this.lastShot = now;
    }

    update(deltaTime) {
        // Calculate vertical speed based on pitch and forward velocity
        const pitchFactor = Math.sin(this.pitch);
        this.verticalSpeed = pitchFactor * this.velocity;

        // Update altitude with vertical speed
        this.altitude += this.verticalSpeed * deltaTime;
        
        // Prevent going below ground
        if (this.altitude < 0) {
            this.altitude = 0;
            this.verticalSpeed = 0;
            this.pitch = Math.max(0, this.pitch); // Force nose up if we hit ground
        }

        // Update position
        this.mesh.position.y = this.altitude;
        
        // Update rotation using quaternions for proper 3D rotation
        const rotation = new THREE.Quaternion();
        
        // Apply heading (yaw) first
        const yawQ = new THREE.Quaternion();
        yawQ.setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.heading);
        rotation.multiply(yawQ);
        
        // Apply pitch relative to current heading
        const pitchQ = new THREE.Quaternion();
        pitchQ.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -this.pitch);
        rotation.multiply(pitchQ);
        
        // Apply roll relative to current orientation
        const rollQ = new THREE.Quaternion();
        rollQ.setFromAxisAngle(new THREE.Vector3(0, 0, 1), -this.roll);
        rotation.multiply(rollQ);
        
        // Apply the combined rotation
        this.mesh.quaternion.copy(rotation);

        // Move forward
        this.mesh.position.x += Math.sin(this.heading) * this.velocity * deltaTime;
        this.mesh.position.z += Math.cos(this.heading) * this.velocity * deltaTime;

        // Update bullets
        this.bullets = this.bullets.filter(bullet => {
            bullet.update(deltaTime);
            if (!bullet.alive) {
                this.scene.remove(bullet.mesh);
            }
            return bullet.alive;
        });
    }

    control(input) {
        // Handle controls
        if (input.throttleDown) {
            // Q key - slow down
            this.velocity = Math.max(this.velocity - this.accelerationRate * 0.016, this.minSpeed);
        } else if (input.throttleUp) {
            // E key - accelerate faster
            this.velocity = Math.min(this.velocity + this.accelerationRate * 0.016, this.maxSpeed);
        }

        // Smooth pitch control
        if (input.pitchUp) {
            this.pitch = Math.min(this.pitch + this.pitchRate * 0.016, this.maxPitch);
        } else if (input.pitchDown) {
            this.pitch = Math.max(this.pitch - this.pitchRate * 0.016, -this.maxPitch);
        }
        
        if (input.turnLeft) this.heading += 0.02;
        else if (input.turnRight) this.heading -= 0.02;

        // Bank the plane during turns
        if (input.turnLeft) this.roll = Math.min(this.roll + 0.02, Math.PI/4);
        else if (input.turnRight) this.roll = Math.max(this.roll - 0.02, -Math.PI/4);
        else {
            // Return to level flight
            if (this.roll > 0) this.roll = Math.max(0, this.roll - 0.01);
            else if (this.roll < 0) this.roll = Math.min(0, this.roll + 0.01);
        }

        if (input.shootMissile) {
            this.shoot();
        }
    }
} 