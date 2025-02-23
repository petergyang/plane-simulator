class EnemyPlane {
    constructor(scene, position) {
        // Create larger enemy plane mesh (4x size)
        const bodyGeometry = new THREE.BoxGeometry(4, 4, 16);
        const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0xff0000 });
        this.mesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
        
        // Add larger wings
        const wingGeometry = new THREE.BoxGeometry(32, 0.8, 8);
        const wingMesh = new THREE.Mesh(wingGeometry, bodyMaterial);
        wingMesh.position.y = 0.8;
        this.mesh.add(wingMesh);

        this.scene = scene; // Store scene for explosion effect
        this.mesh.position.copy(position);
        this.speed = 30;
        this.heading = Math.random() * Math.PI * 2;
        this.alive = true;
        this.health = 3;
        
        // Add patrol parameters
        this.patrolRadius = 300;
        this.patrolHeight = 150;
        this.patrolCenter = new THREE.Vector3(0, this.patrolHeight, 0);
        this.turnRate = 0.3;
        
        scene.add(this.mesh);
    }

    createExplosion() {
        const explosionParticles = 20;
        const particles = [];
        
        // Create explosion fragments
        for (let i = 0; i < explosionParticles; i++) {
            const geometry = new THREE.BoxGeometry(2, 2, 2);
            const material = new THREE.MeshPhongMaterial({ 
                color: Math.random() > 0.5 ? 0xff4400 : 0xff8800,
                emissive: 0xff0000,
                emissiveIntensity: 0.5
            });
            
            const particle = new THREE.Mesh(geometry, material);
            particle.position.copy(this.mesh.position);
            
            // Random velocity for each particle
            particle.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 20,
                Math.random() * 15,
                (Math.random() - 0.5) * 20
            );
            
            particle.lifetime = 1 + Math.random(); // Random lifetime between 1-2 seconds
            particles.push(particle);
            this.scene.add(particle);
        }

        // Animate explosion
        const animate = (time) => {
            let allDead = true;
            particles.forEach(particle => {
                if (particle.lifetime > 0) {
                    allDead = false;
                    // Update position
                    particle.position.add(particle.velocity.clone().multiplyScalar(0.016));
                    // Add gravity
                    particle.velocity.y -= 20 * 0.016;
                    // Reduce lifetime
                    particle.lifetime -= 0.016;
                    // Fade out
                    particle.material.opacity = particle.lifetime;
                    particle.material.transparent = true;
                    // Spin
                    particle.rotation.x += 0.1;
                    particle.rotation.y += 0.1;
                } else if (particle.parent) {
                    this.scene.remove(particle);
                }
            });
            
            if (!allDead) {
                requestAnimationFrame(animate);
            }
        };
        
        requestAnimationFrame(animate);
    }

    update(deltaTime) {
        if (!this.alive) return;

        // Calculate desired position on patrol circle
        const targetX = this.patrolCenter.x + Math.cos(this.heading) * this.patrolRadius;
        const targetZ = this.patrolCenter.z + Math.sin(this.heading) * this.patrolRadius;

        // Update heading more smoothly
        this.heading += this.turnRate * deltaTime;
        
        // Move forward
        this.mesh.position.x = targetX;
        this.mesh.position.z = targetZ;
        this.mesh.position.y = this.patrolHeight;

        // Update rotation
        this.mesh.rotation.y = this.heading + Math.PI / 2;
        
        // Add slight banking in turns
        this.mesh.rotation.z = -0.2;
    }

    hit() {
        this.health--;
        if (this.health <= 0) {
            this.alive = false;
            this.mesh.visible = false;
            this.createExplosion();
        }
    }

    checkBulletCollision(bullet) {
        if (!this.alive) return false;
        
        // Simple distance-based collision
        const distance = this.mesh.position.distanceTo(bullet.mesh.position);
        return distance < 5; // Hit if bullet is within 5 units
    }
} 