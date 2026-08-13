import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyCorinthCurriculum } from './corinthCurriculum.js';

test('maps human anatomy to secondary biology classes', () => {
  const result = classifyCorinthCurriculum({
    category: 'Human Biology',
    title: 'Heart - Section',
    description: 'Explore the chambers and tissues of the human heart.',
  });

  assert.equal(result.subject, 'Biology');
  assert.deepEqual(result.gradeBands, ['7', '8', '9', '10', '11']);
  assert.ok(result.curriculumTags.includes('human-anatomy'));
});

test('maps plant reproductive structures to middle and senior biology', () => {
  const result = classifyCorinthCurriculum({
    category: 'Plant Biology',
    title: 'Scots Pine - Female Cone',
    description: 'Inspect a female cone and its reproductive structures.',
  });

  assert.deepEqual(result.gradeBands, ['6', '7', '8', '9', '11']);
  assert.ok(result.curriculumTags.includes('plant-reproduction'));
});

test('maps mechanics equipment to the appropriate physics progression', () => {
  const result = classifyCorinthCurriculum({
    category: 'Physics',
    title: 'Hydraulic Jack',
    description: 'A hydraulic machine demonstrating force and pressure.',
  });

  assert.equal(result.subject, 'Physics');
  assert.deepEqual(result.gradeBands, ['7', '8', '9', '11']);
  assert.ok(result.curriculumTags.includes('force-and-machines'));
});

test('maps molecular structure content to senior chemistry', () => {
  const result = classifyCorinthCurriculum({
    category: 'Chemistry',
    title: 'Orbital Hybridization - sp3',
    description: 'Visualize atomic orbital hybridization and molecular geometry.',
  });

  assert.equal(result.subject, 'Chemistry');
  assert.deepEqual(result.gradeBands, ['9', '10', '11', '12']);
  assert.ok(result.curriculumTags.includes('chemical-bonding'));
});

test('uses conservative category defaults for unfamiliar content', () => {
  const result = classifyCorinthCurriculum({
    category: 'Animal Biology',
    title: 'New Zoology Specimen',
    description: '',
  });

  assert.deepEqual(result.gradeBands, ['6', '7', '8', '9', '11']);
  assert.ok(result.curriculumTags.includes('animal-biology'));
});
