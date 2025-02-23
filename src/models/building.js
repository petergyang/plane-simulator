class Building {
    constructor(scene, width, height, depth) {
        this.scene = scene;
        this.alive = true;
        this.health = 5; // Takes more hits than planes
        this.width = width;
        this.height = height;
        this.depth = depth;

        const geometry = new THREE.BoxGeometry(width, height, depth);
        
        // Create windows texture
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        
        // Building color variations - realistic building colors
        const buildingColors = [
            '#a3a3a3', // Classic gray
            '#d9d0c1', // Beige concrete
            '#c4b5a3', // Sandstone
            '#8b8681', // Warm gray
            '#a59c94', // Taupe
            '#b8b2a9', // Light stone
            '#8f8f8f', // Dark gray
            '#c1b6a3', // Limestone
            '#b5ad9f', // Weathered concrete
            '#a69f95'  // Brownish gray
        ];
        
        ctx.fillStyle = buildingColors[Math.floor(Math.random() * buildingColors.length)];
        ctx.fillRect(0, 0, 128, 128);
        
        // Windows with slight variations
        const windowColors = [
            '#2a2a2a', // Dark gray
            '#1f1f1f', // Nearly black
            '#333333', // Medium gray
            '#404040'  // Light gray
        ];
        
        ctx.fillStyle = windowColors[Math.floor(Math.random() * windowColors.length)];
        const windowRows = 8;
        const windowCols = 6;
        const windowSize = 12;
        const windowSpacing = (128 - windowCols * windowSize) / (windowCols + 1);
        
        for(let x = 0; x < windowCols; x++) {
            for(let y = 0; y < windowRows; y++) {
                ctx.fillRect(
                    windowSpacing + x * (windowSize + windowSpacing),
                    windowSpacing + y * (windowSize + windowSpacing),
                    windowSize,
                    windowSize
                );
            }
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(1, height / 20);

        const material = new THREE.MeshPhongMaterial({
            map: texture,
            side: THREE.DoubleSide
        });

        this.mesh = new THREE.Mesh(geometry, material);
        scene.add(this.mesh);
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
        const explosionParticles = 30;
        const particles = [];
        
        // Create concrete debris and smoke
        for (let i = 0; i < explosionParticles; i++) {
            const size = Math.random() * 4 + 2;
            const geometry = new THREE.BoxGeometry(size, size, size);
            const material = new THREE.MeshPhongMaterial({ 
                color: Math.random() > 0.5 ? 0x808080 : 0x606060,
                emissive: 0x404040,
                emissiveIntensity: 0.2
            });
            
            const particle = new THREE.Mesh(geometry, material);
            particle.position.copy(this.mesh.position);
            
            // Add random offset within building bounds
            particle.position.x += (Math.random() - 0.5) * this.width;
            particle.position.y += Math.random() * this.height;
            particle.position.z += (Math.random() - 0.5) * this.depth;
            
            // Random velocity
            particle.velocity = new THREE.Vector3(
                (Math.random() - 0.5) * 30,
                Math.random() * 20,
                (Math.random() - 0.5) * 30
            );
            
            particle.lifetime = 2 + Math.random();
            particles.push(particle);
            this.scene.add(particle);
        }

        // Animate debris
        const animate = (time) => {
            let allDead = true;
            particles.forEach(particle => {
                if (particle.lifetime > 0) {
                    allDead = false;
                    particle.position.add(particle.velocity.clone().multiplyScalar(0.016));
                    particle.velocity.y -= 30 * 0.016; // Stronger gravity for building debris
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
        
        const bulletPos = bullet.mesh.position;
        const buildingPos = this.mesh.position;
        
        // Check if bullet is within building bounds
        return (
            bulletPos.x >= buildingPos.x - this.width/2 &&
            bulletPos.x <= buildingPos.x + this.width/2 &&
            bulletPos.y >= buildingPos.y - this.height/2 &&
            bulletPos.y <= buildingPos.y + this.height/2 &&
            bulletPos.z >= buildingPos.z - this.depth/2 &&
            bulletPos.z <= buildingPos.z + this.depth/2
        );
    }
} 