/**
 * Example: How to use the Curriculum Schema
 * 
 * This file demonstrates how to create and manage curriculum chapters
 * using the schema structure you provided.
 */

import { createCurriculumService } from '../server/client/src/services/curriculumService';
import { db } from './firebase'; // Your Firebase instance

// Example: Your JSON structure
const exampleChapterData = {
  "curriculum": "CBSE",
  "class": 8,
  "subject": "Science",
  "chapter_number": 3,
  "chapter_name": "Synthetic Fibres and Plastics",
  "topics": [
    {
      "topic_id": "auto_generated_uuid",
      "topic_name": "Structure of Synthetic Fibres",
      "topic_priority": 1,
      "learning_objective": "Understand how polymer chains form synthetic fibres and how their structure affects strength and flexibility.",
      "scene_type": "mixed",
      "in3d_prompt": "A cutaway 3D visualization showing long polymer chains arranged in parallel strands, zoomed-in molecular structures transitioning into visible fibre threads, neutral background, clear spacing between chains, soft studio lighting, camera switching from macro to mid-range view.",
      "asset_list": ["polymer chains", "fiber strands", "molecular nodes"],
      "camera_guidance": "Start with close-up molecular view, slowly zoom out to show fibre formation"
    }
  ]
};

/**
 * Example 1: Save a new chapter
 */
async function saveExampleChapter() {
  const curriculumService = createCurriculumService(db);
  
  // Generate UUID for topic_id (in production, use a proper UUID library)
  const topicId = `topic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const topics = exampleChapterData.topics.map(topic => ({
    ...topic,
    topic_id: topicId, // Replace "auto_generated_uuid" with actual UUID
  }));
  
  const documentId = await curriculumService.saveChapter(
    exampleChapterData.curriculum,
    exampleChapterData.class,
    exampleChapterData.subject,
    exampleChapterData.chapter_number,
    exampleChapterData.chapter_name,
    topics.map(({ topic_id, ...rest }) => rest) // Remove topic_id, service will generate it
  );
  
  console.log('Chapter saved with ID:', documentId);
  // Output: "CBSE_8_Science_ch3"
}

/**
 * Example 2: Get a chapter
 */
async function getExampleChapter() {
  const curriculumService = createCurriculumService(db);
  
  const chapter = await curriculumService.getChapter(
    'CBSE',
    8,
    'Science',
    3
  );
  
  if (chapter) {
    console.log('Chapter found:', chapter.chapter_name);
    console.log('Topics:', chapter.topics.length);
  } else {
    console.log('Chapter not found');
  }
}

/**
 * Example 3: Query chapters by curriculum, class, and subject
 */
async function queryChapters() {
  const curriculumService = createCurriculumService(db);
  
  const chapters = await curriculumService.getChapters({
    curriculum: 'CBSE',
    class: 8,
    subject: 'Science',
  });
  
  console.log(`Found ${chapters.length} chapters`);
  chapters.forEach(chapter => {
    console.log(`- Chapter ${chapter.chapter_number}: ${chapter.chapter_name}`);
  });
}

/**
 * Example 4: Update topic with skybox ID after generation
 */
async function updateTopicWithSkybox() {
  const curriculumService = createCurriculumService(db);
  
  const documentId = 'CBSE_8_Science_ch3';
  const topicId = 'your_topic_id_here';
  const skyboxId = '1234567890'; // From skyboxes collection
  
  await curriculumService.updateTopicSkybox(
    documentId,
    topicId,
    skyboxId
  );
  
  console.log('Topic updated with skybox reference');
}

/**
 * Example 5: Add multiple skybox variations to a topic
 */
async function addMultipleSkyboxes() {
  const curriculumService = createCurriculumService(db);
  
  const documentId = 'CBSE_8_Science_ch3';
  const topicId = 'your_topic_id_here';
  const skyboxIds = ['skybox1', 'skybox2', 'skybox3']; // Multiple variations
  
  await curriculumService.addTopicSkyboxes(
    documentId,
    topicId,
    skyboxIds
  );
  
  console.log('Multiple skyboxes added to topic');
}

/**
 * Example 6: Update topic with 3D asset references
 */
async function updateTopicWithAssets() {
  const curriculumService = createCurriculumService(db);
  
  const curriculumService = createCurriculumService(db);
  
  const documentId = 'CBSE_8_Science_ch3';
  const topicId = 'your_topic_id_here';
  const assetIds = ['asset1', 'asset2', 'asset3']; // From 3d_assets collection
  
  await curriculumService.updateTopicAssets(
    documentId,
    topicId,
    assetIds
  );
  
  console.log('Topic updated with asset references');
}

/**
 * Example 7: Complete workflow - Create chapter, generate skybox, link them
 */
async function completeWorkflow() {
  const curriculumService = createCurriculumService(db);
  
  // Step 1: Save the chapter
  const documentId = await curriculumService.saveChapter(
    'CBSE',
    8,
    'Science',
    3,
    'Synthetic Fibres and Plastics',
    [
      {
        topic_name: 'Structure of Synthetic Fibres',
        topic_priority: 1,
        learning_objective: 'Understand how polymer chains form synthetic fibres...',
        scene_type: 'mixed',
        in3d_prompt: 'A cutaway 3D visualization showing long polymer chains...',
        asset_list: ['polymer chains', 'fiber strands', 'molecular nodes'],
        camera_guidance: 'Start with close-up molecular view, slowly zoom out...',
      },
    ]
  );
  
  // Step 2: Get the chapter to find the topic_id
  const chapter = await curriculumService.getChapterById(documentId);
  if (!chapter) {
    throw new Error('Chapter not found');
  }
  
  const topic = chapter.topics[0];
  const topicId = topic.topic_id;
  
  // Step 3: Generate skybox (your existing skybox generation code)
  // ... your skybox generation logic here ...
  // const skyboxId = await generateSkybox(topic.in3d_prompt);
  
  // Step 4: Link skybox to topic
  // await curriculumService.updateTopicSkybox(documentId, topicId, skyboxId);
  
  console.log('Complete workflow finished');
}

// Export examples for use
export {
  saveExampleChapter,
  getExampleChapter,
  queryChapters,
  updateTopicWithSkybox,
  addMultipleSkyboxes,
  updateTopicWithAssets,
  completeWorkflow,
};
