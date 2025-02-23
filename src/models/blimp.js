class Blimp {
    constructor(scene, position) {
        this.scene = scene;
        this.alive = true;
        this.health = 1;

        // Add shadows to UFO parts
        const addShadows = (mesh) => {
            mesh.castShadow = true;
            mesh.receiveShadow = true;
        };

        // Create UFO body
        const bodyGeometry = new THREE.SphereGeometry(45, 32, 32);
        const bodyMaterial = new THREE.MeshPhongMaterial({ 
            color: 0xff0000,
            flatShading: false,
            shininess: 100
        });
        this.mesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
        this.mesh.scale.y = 0.2;
        addShadows(this.mesh);

        // Add bottom dome
        const domeGeometry = new THREE.SphereGeometry(22, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
        const dome = new THREE.Mesh(domeGeometry, bodyMaterial);
        dome.position.y = -7;
        addShadows(dome);
        this.mesh.add(dome);

        // Set initial position and properties
        this.mesh.position.copy(position);
        this.speed = 5;
        this.heading = Math.random() * Math.PI * 2;
        
        // Make it hover up and down slightly
        this.hoverOffset = Math.random() * Math.PI * 2;
        this.originalY = position.y;
        
        scene.add(this.mesh);
    }

    update(deltaTime) {
        if (!this.alive) return;

        // Move in a large circle
        this.heading += 0.05 * deltaTime;
        
        // Update position with hovering effect
        const radius = 500;
        this.mesh.position.x = Math.cos(this.heading) * radius;
        this.mesh.position.z = Math.sin(this.heading) * radius;
        this.mesh.position.y = this.originalY + Math.sin(this.hoverOffset + this.heading * 2) * 10;
        
        // Rotate slowly for UFO effect
        this.mesh.rotation.y += deltaTime * 0.5;
    }

    hit() {
        this.alive = false;
        this.mesh.visible = false;
        this.createExplosion();
    }

    createExplosion() {
        const explosionParticles = 30;
        const particles = [];
        
        for (let i = 0; i < explosionParticles; i++) {
            const geometry = new THREE.BoxGeometry(3, 3, 3);
            const material = new THREE.MeshPhongMaterial({ 
                color: Math.random() > 0.5 ? 0xff4400 : 0xff8800,
                emissive: 0xff0000,
                emissiveIntensity: 0.5
            });
            
            const particle = new THREE.Mesh(geometry, material);
            particle.position.copy(this.mesh.position);
            
            particle.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 30,
                Math.random() * 20,
                (Math.random() - 0.5) * 30
            );
            
            particle.lifetime = 2 + Math.random();
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
        
        // Simple distance-based collision with larger radius
        const distance = this.mesh.position.distanceTo(bullet.mesh.position);
        return distance < 25; // Increased from 15 to match larger UFO size
    }
} 