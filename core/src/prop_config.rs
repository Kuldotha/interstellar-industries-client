pub struct BiomeProps {
    pub background_chance: [[f32; 2]; 3],
}

pub const BLUE_PLANET: BiomeProps = BiomeProps {
    background_chance: [
        [0.0, 0.0],
        [0.14, 0.0],
        [0.0, 0.0],
    ],
};
