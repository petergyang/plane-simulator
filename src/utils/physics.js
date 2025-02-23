class Physics {
    static calculateLift(velocity, angleOfAttack) {
        // Simple lift calculation
        const liftCoefficient = 0.3;
        const airDensity = 1.225;
        return (airDensity * velocity * velocity * liftCoefficient * angleOfAttack) / 2;
    }

    static calculateDrag(velocity) {
        // Simple drag calculation
        const dragCoefficient = 0.025;
        const airDensity = 1.225;
        const frontalArea = 2;
        return (airDensity * velocity * velocity * dragCoefficient * frontalArea) / 2;
    }
} 