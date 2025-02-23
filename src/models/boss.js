class BossUFO {
    constructor(scene, position) {
        this.scene = scene;
        this.alive = true;
        this.health = 20;

        // Create massive UFO body - much bigger
        const bodyGeometry = new THREE.SphereGeometry(250, 32, 32); // Increased from 120
        const bodyMaterial = new THREE.MeshPhongMaterial({ 
            color: 0xff0000,
            flatShading: false,
            shininess: 100,
            emissive: 0x330000,
            emissiveIntensity: 0.2
        });
        this.mesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
        this.mesh.scale.y = 0.15; // Made slightly flatter

        // Add massive bottom dome
        const domeGeometry = new THREE.SphereGeometry(125, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2); // Increased from 60
        const dome = new THREE.Mesh(domeGeometry, bodyMaterial);
        dome.position.y = -35; // Adjusted for new size
        this.mesh.add(dome);

        // Add more glowing lights around the rim
        const lightCount = 16; // Increased from 12
        for (let i = 0; i < lightCount; i++) {
            const angle = (i / lightCount) * Math.PI * 2;
            const light = new THREE.PointLight(0xff0000, 1.5, 200); // Brighter, longer range
            light.position.set(
                Math.cos(angle) * 200, // Increased radius
                -20,
                Math.sin(angle) * 200
            );
            this.mesh.add(light);
        }

        // Enable shadows
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        dome.castShadow = true;
        dome.receiveShadow = true;

        // Set position and properties
        this.mesh.position.copy(position);
        this.heading = 0;
        
        // Hover effect
        this.hoverOffset = Math.random() * Math.PI * 2;
        this.originalY = position.y;
        
        scene.add(this.mesh);
    }

    update(deltaTime) {
        if (!this.alive) return;
        
        // Just hover up and down in place
        this.heading += 0.01 * deltaTime;
        this.mesh.position.y = this.originalY + Math.sin(this.hoverOffset + this.heading) * 30;
        
        // Slow rotation in place
        this.mesh.rotation.y += deltaTime * 0.05;
    }

    hit() {
        this.health--;
        if (this.health <= 0 && this.alive) {
            this.alive = false;
            this.mesh.visible = false;
            this.createExplosion();
        }
    }

    createExplosion() {
        const explosionParticles = 100; // More particles for bigger explosion
        const particles = [];
        
        for (let i = 0; i < explosionParticles; i++) {
            const geometry = new THREE.BoxGeometry(8, 8, 8);
            const material = new THREE.MeshPhongMaterial({ 
                color: Math.random() > 0.5 ? 0xff4400 : 0xff8800,
                emissive: 0xff0000,
                emissiveIntensity: 0.8
            });
            
            const particle = new THREE.Mesh(geometry, material);
            particle.position.copy(this.mesh.position);
            
            particle.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 60,
                Math.random() * 40,
                (Math.random() - 0.5) * 60
            );
            
            particle.lifetime = 4 + Math.random() * 2; // Longer lasting explosion
            particles.push(particle);
            this.scene.add(particle);
        }

        const animate = (time) => {
            let allDead = true;
            particles.forEach(particle => {
                if (particle.lifetime > 0) {
                    allDead = false;
                    particle.position.add(particle.velocity.clone().multiplyScalar(0.016));
                    particle.velocity.y -= 20 * 0.016;
                    particle.lifetime -= 0.016;
                    particle.material.opacity = particle.lifetime / 2;
                    particle.material.transparent = true;
                    particle.rotation.x += particle.velocity.length() * 0.01;
                    particle.rotation.z += particle.velocity.length() * 0.01;
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

    checkBulletCollision(bullet) {
        if (!this.alive) return false;
        
        const distance = this.mesh.position.distanceTo(bullet.mesh.position);
        return distance < 80; // Increased collision radius for larger size
    }
} 