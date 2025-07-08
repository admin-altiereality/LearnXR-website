import { 
  collection, 
  addDoc, 
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../config/firebase';

// Initial Skybox Styles Data
const initialSkyboxStyles = [
  {
    name: "Cyberpunk Night City",
    description: "A futuristic cyberpunk cityscape with neon lights and towering skyscrapers",
    category: "sci-fi",
    preview_url: "https://images.blockadelabs.com/images/imagine/Digital_Painting_equirectangular-jpg_A_cyberpunk_night_932592572_12806524.jpg?ver=1",
    image_jpg: "https://images.blockadelabs.com/images/imagine/Digital_Painting_equirectangular-jpg_A_cyberpunk_night_932592572_12806524.jpg?ver=1",
    tags: ["cyberpunk", "city", "night", "neon", "futuristic"],
    author: "In3D.Ai",
    likes: 2345,
    views: 12000,
    downloads: 890,
    uses: 567,
    isTrending: true,
    isStaffPick: true,
    difficulty: "intermediate",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  },
  {
    name: "Serene Forest",
    description: "A peaceful forest scene with sunlight filtering through trees",
    category: "nature",
    preview_url: "https://images.blockadelabs.com/images/imagine/Digital_Painting_equirectangular-jpg_A_serene_forest_with_932592572_12806524.jpg?ver=1",
    image_jpg: "https://images.blockadelabs.com/images/imagine/Digital_Painting_equirectangular-jpg_A_serene_forest_with_932592572_12806524.jpg?ver=1",
    tags: ["forest", "nature", "peaceful", "sunlight", "trees"],
    author: "In3D.Ai",
    likes: 1890,
    views: 9500,
    downloads: 654,
    uses: 432,
    isTrending: true,
    isStaffPick: false,
    difficulty: "beginner",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  },
  {
    name: "Space Station",
    description: "A massive space station orbiting a distant planet",
    category: "sci-fi",
    preview_url: "https://images.blockadelabs.com/images/imagine/Digital_Painting_equirectangular-jpg_A_space_station_with_932592572_12806524.jpg?ver=1",
    image_jpg: "https://images.blockadelabs.com/images/imagine/Digital_Painting_equirectangular-jpg_A_space_station_with_932592572_12806524.jpg?ver=1",
    tags: ["space", "station", "sci-fi", "technology", "orbital"],
    author: "In3D.Ai",
    likes: 1567,
    views: 8200,
    downloads: 543,
    uses: 321,
    isTrending: true,
    isStaffPick: false,
    difficulty: "advanced",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  },
  {
    name: "Magical Castle",
    description: "An enchanted castle floating in the clouds",
    category: "fantasy",
    preview_url: "https://images.blockadelabs.com/images/imagine/Digital_Painting_equirectangular-jpg_A_magical_castle_in_932592572_12806524.jpg?ver=1",
    image_jpg: "https://images.blockadelabs.com/images/imagine/Digital_Painting_equirectangular-jpg_A_magical_castle_in_932592572_12806524.jpg?ver=1",
    tags: ["fantasy", "castle", "magical", "floating", "clouds"],
    author: "In3D.Ai",
    likes: 2100,
    views: 11000,
    downloads: 789,
    uses: 456,
    isTrending: true,
    isStaffPick: true,
    difficulty: "intermediate",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  },
  {
    name: "Abstract Geometric",
    description: "Abstract geometric patterns with vibrant colors",
    category: "abstract",
    preview_url: "https://images.blockadelabs.com/images/imagine/Digital_Painting_equirectangular-jpg_Abstract_geometric_patterns_932592572_12806524.jpg?ver=1",
    image_jpg: "https://images.blockadelabs.com/images/imagine/Digital_Painting_equirectangular-jpg_Abstract_geometric_patterns_932592572_12806524.jpg?ver=1",
    tags: ["abstract", "geometric", "patterns", "vibrant", "modern"],
    author: "In3D.Ai",
    likes: 987,
    views: 5200,
    downloads: 234,
    uses: 123,
    isTrending: false,
    isStaffPick: false,
    difficulty: "beginner",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  },
  {
    name: "Modern Cityscape",
    description: "A modern city with glass skyscrapers and busy streets",
    category: "urban",
    preview_url: "https://images.blockadelabs.com/images/imagine/Digital_Painting_equirectangular-jpg_A_modern_city_with_932592572_12806524.jpg?ver=1",
    image_jpg: "https://images.blockadelabs.com/images/imagine/Digital_Painting_equirectangular-jpg_A_modern_city_with_932592572_12806524.jpg?ver=1",
    tags: ["urban", "city", "modern", "skyscrapers", "architecture"],
    author: "In3D.Ai",
    likes: 1345,
    views: 7200,
    downloads: 456,
    uses: 234,
    isTrending: false,
    isStaffPick: false,
    difficulty: "intermediate",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }
];

// Initial Tutorials Data
const initialTutorials = [
  {
    title: "Getting Started with In3D.Ai",
    description: "Learn the basics of creating 3D environments with In3D.Ai",
    content: "This tutorial covers the fundamentals of using In3D.Ai to create stunning 3D environments...",
    videoUrl: "https://www.youtube.com/watch?v=example1",
    thumbnailUrl: "https://images.blockadelabs.com/images/imagine/Digital_Painting_equirectangular-jpg_A_serene_forest_with_932592572_12806524.jpg?ver=1",
    author: "In3D.Ai Team",
    category: "basics",
    difficulty: "beginner",
    duration: 15,
    views: 5000,
    likes: 234,
    tags: ["beginner", "basics", "introduction"],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  },
  {
    title: "Advanced Lighting Techniques",
    description: "Master advanced lighting techniques for realistic 3D scenes",
    content: "In this advanced tutorial, we'll explore sophisticated lighting techniques...",
    videoUrl: "https://www.youtube.com/watch?v=example2",
    thumbnailUrl: "https://images.blockadelabs.com/images/imagine/Digital_Painting_equirectangular-jpg_A_cyberpunk_night_932592572_12806524.jpg?ver=1",
    author: "Lighting Expert",
    category: "lighting",
    difficulty: "advanced",
    duration: 45,
    views: 2300,
    likes: 156,
    tags: ["advanced", "lighting", "realistic"],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  },
  {
    title: "Creating Fantasy Environments",
    description: "Design magical and fantastical 3D environments",
    content: "Learn how to create enchanting fantasy worlds with In3D.Ai...",
    videoUrl: "https://www.youtube.com/watch?v=example3",
    thumbnailUrl: "https://images.blockadelabs.com/images/imagine/Digital_Painting_equirectangular-jpg_A_magical_castle_in_932592572_12806524.jpg?ver=1",
    author: "Fantasy Artist",
    category: "fantasy",
    difficulty: "intermediate",
    duration: 30,
    views: 3400,
    likes: 189,
    tags: ["fantasy", "magical", "environments"],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }
];

// Initial Community Posts Data
const initialCommunityPosts = [
  {
    title: "My First Cyberpunk Scene",
    content: "Just created my first cyberpunk environment using In3D.Ai! The results are amazing...",
    authorId: "user1",
    authorName: "CyberArtist",
    authorAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=CyberArtist",
    skyboxStyleId: "cyberpunk-night-city",
    skyboxImage: "https://images.blockadelabs.com/images/imagine/Digital_Painting_equirectangular-jpg_A_cyberpunk_night_932592572_12806524.jpg?ver=1",
    likes: 45,
    comments: 12,
    views: 234,
    tags: ["cyberpunk", "first-project", "showcase"],
    isPinned: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  },
  {
    title: "Tips for Better Lighting",
    content: "Here are some tips I've learned for creating better lighting in your 3D scenes...",
    authorId: "user2",
    authorName: "LightingMaster",
    authorAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=LightingMaster",
    likes: 67,
    comments: 23,
    views: 456,
    tags: ["lighting", "tips", "tutorial"],
    isPinned: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  },
  {
    title: "Fantasy Castle Creation",
    content: "Check out this magical castle I created! Used the floating castle style as inspiration...",
    authorId: "user3",
    authorName: "FantasyCreator",
    authorAvatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=FantasyCreator",
    skyboxStyleId: "magical-castle",
    skyboxImage: "https://images.blockadelabs.com/images/imagine/Digital_Painting_equirectangular-jpg_A_magical_castle_in_932592572_12806524.jpg?ver=1",
    likes: 89,
    comments: 15,
    views: 567,
    tags: ["fantasy", "castle", "showcase"],
    isPinned: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }
];

// Initial Style Categories Data
const initialStyleCategories = [
  {
    id: "sci-fi",
    name: "Sci-Fi Environments",
    description: "Futuristic worlds, space stations, and advanced technology landscapes",
    image: "https://images.blockadelabs.com/images/imagine/Digital_Painting_equirectangular-jpg_A_futuristic_space_station_932592572_12806524.jpg?ver=1",
    examples: ["Cyberpunk Cities", "Space Stations", "Alien Worlds"],
    styleCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  },
  {
    id: "nature",
    name: "Natural Landscapes",
    description: "Breathtaking outdoor scenes, from serene forests to majestic mountains",
    image: "https://images.blockadelabs.com/images/imagine/Digital_Painting_equirectangular-jpg_A_serene_forest_with_932592572_12806524.jpg?ver=1",
    examples: ["Forest Scenes", "Mountain Vistas", "Ocean Views"],
    styleCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  },
  {
    id: "fantasy",
    name: "Fantasy Realms",
    description: "Magical environments filled with wonder and mystical elements",
    image: "https://images.blockadelabs.com/images/imagine/Digital_Painting_equirectangular-jpg_A_magical_castle_in_932592572_12806524.jpg?ver=1",
    examples: ["Magical Castles", "Enchanted Forests", "Dragon Lairs"],
    styleCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  },
  {
    id: "abstract",
    name: "Abstract Designs",
    description: "Non-representational artistic expressions and geometric patterns",
    image: "https://images.blockadelabs.com/images/imagine/Digital_Painting_equirectangular-jpg_Abstract_geometric_patterns_932592572_12806524.jpg?ver=1",
    examples: ["Geometric Patterns", "Color Fields", "Fractal Art"],
    styleCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  },
  {
    id: "urban",
    name: "Urban Environments",
    description: "Modern cityscapes and architectural marvels",
    image: "https://images.blockadelabs.com/images/imagine/Digital_Painting_equirectangular-jpg_A_modern_city_with_932592572_12806524.jpg?ver=1",
    examples: ["Modern Cities", "Historic Towns", "Industrial Zones"],
    styleCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }
];

// Function to populate Firebase with initial data
export const populateFirebase = async () => {
  try {
    console.log('Starting Firebase population...');

    // Add Skybox Styles
    console.log('Adding skybox styles...');
    for (const style of initialSkyboxStyles) {
      const docRef = await addDoc(collection(db, 'skyboxStyles'), style);
      console.log(`Added skybox style: ${style.name} with ID: ${docRef.id}`);
    }

    // Add Tutorials
    console.log('Adding tutorials...');
    for (const tutorial of initialTutorials) {
      const docRef = await addDoc(collection(db, 'tutorials'), tutorial);
      console.log(`Added tutorial: ${tutorial.title} with ID: ${docRef.id}`);
    }

    // Add Community Posts
    console.log('Adding community posts...');
    for (const post of initialCommunityPosts) {
      const docRef = await addDoc(collection(db, 'communityPosts'), post);
      console.log(`Added community post: ${post.title} with ID: ${docRef.id}`);
    }

    // Add Style Categories
    console.log('Adding style categories...');
    for (const category of initialStyleCategories) {
      const docRef = await addDoc(collection(db, 'styleCategories'), category);
      console.log(`Added style category: ${category.name} with ID: ${docRef.id}`);
    }

    console.log('Firebase population completed successfully!');
  } catch (error) {
    console.error('Error populating Firebase:', error);
    throw error;
  }
};

// Function to populate trending data
export const populateTrendingData = async () => {
  try {
    console.log('Populating trending data...');
    
    // Get all skybox styles
    const stylesSnapshot = await getDocs(collection(db, 'skyboxStyles'));
    
    for (const styleDoc of stylesSnapshot.docs) {
      const styleData = styleDoc.data();
      const trendScore = (styleData.views * 0.1) + (styleData.likes * 0.3) + (styleData.downloads * 0.5) + (styleData.uses * 0.8);
      
      await addDoc(collection(db, 'trendingData'), {
        skyboxStyleId: styleDoc.id,
        views: styleData.views || 0,
        likes: styleData.likes || 0,
        downloads: styleData.downloads || 0,
        uses: styleData.uses || 0,
        trendScore,
        lastUpdated: serverTimestamp()
      });
    }
    
    console.log('Trending data populated successfully!');
  } catch (error) {
    console.error('Error populating trending data:', error);
    throw error;
  }
};

// Export for use in other files
export default {
  populateFirebase,
  populateTrendingData,
  initialSkyboxStyles,
  initialTutorials,
  initialCommunityPosts,
  initialStyleCategories
}; 