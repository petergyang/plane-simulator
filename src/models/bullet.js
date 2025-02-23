class Bullet {
    constructor(scene, position, direction) {
        // Create bullet tracer geometry
        const geometry = new THREE.BoxGeometry(0.1, 0.1, 1);
        const material = new THREE.MeshPhongMaterial({ 
            color: 0xffff00,
            emissive: 0xffff00,
            emissiveIntensity: 0.5
        });
        
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(position);
        
        // Store bullet properties
        this.direction = direction;
        this.speed = 300; // bullets move fast
        this.lifetime = 2; // seconds before disappearing
        this.alive = true;
        
        scene.add(this.mesh);
    }

    update(deltaTime) {
        // Update lifetime
        this.lifetime -= deltaTime;
        if (this.lifetime <= 0) {
            this.alive = false;
            return;
        }

        // Move bullet forward
        this.mesh.position.x += this.direction.x * this.speed * deltaTime;
        this.mesh.position.y += this.direction.y * this.speed * deltaTime;
        this.mesh.position.z += this.direction.z * this.speed * deltaTime;
    }
} 