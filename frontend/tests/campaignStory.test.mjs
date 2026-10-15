import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { STORY_STAGES, STORY_TRACKS, storyStageAt } from '../src/components/landing/campaignStory.js'

test('all chapter destinations land in their own reading interval', () => {
  assert.equal(STORY_STAGES.length, 4)
  STORY_STAGES.forEach((stage, index) => {
    assert.equal(storyStageAt(stage.position), index)
    assert.ok(stage.description.length > 40)
  })
})

test('scroll chapters are reversible, clamped and deterministic at transitions', () => {
  assert.deepEqual([0, .219, .22, .499, .50, .759, .76, 1].map(storyStageAt), [0, 0, 1, 1, 2, 2, 3, 3])
  assert.deepEqual([1, .61, .35, .04].map(storyStageAt), [3, 2, 1, 0])
  assert.equal(storyStageAt(-1), 0)
  assert.equal(storyStageAt(2), 3)
  assert.equal(storyStageAt(NaN), 0)
})

test('choreography is finite, strictly ordered, and bounded throughout the story', () => {
  for (const [name, { input, output }] of Object.entries(STORY_TRACKS)) {
    assert.equal(input.length, output.length, name)
    assert.equal(input[0], 0, name)
    assert.equal(input.at(-1), 1, name)
    input.forEach((value, i) => assert.ok(i === 0 || value > input[i - 1], name))
    output.forEach(value => assert.ok(Number.isFinite(value), name))
    if (/Opacity|connections/.test(name)) output.forEach(value => assert.ok(value >= 0 && value <= 1, name))
  }
  assert.equal(STORY_TRACKS.briefOpacity.output[0], 1)
  assert.equal(STORY_TRACKS.contentOpacity.output.at(-1), 1)
  assert.equal(STORY_TRACKS.reviewOpacity.output.at(-1), 1)
  assert.equal(STORY_TRACKS.connections.output.at(-1), 1)
})

test('static fallback preserves all stages and the actual TikTok handoff', () => {
  const story = readFileSync(new URL('../src/components/landing/HowItWorks.jsx', import.meta.url), 'utf8')
  const styles = readFileSync(new URL('../src/components/landing/campaign-story.css', import.meta.url), 'utf8')
  assert.match(story, /useSyncExternalStore/)
  assert.match(story, /min-height: 700px/)
  assert.match(story, /min-width: 1100px/)
  assert.match(story, /return animate \? <AnimatedStory \/> : <StaticStory \/>/)
  assert.match(story, /aria-current=/)
  assert.match(story, /aria-hidden="true"/)
  assert.match(story, /story-static-steps/)
  assert.match(STORY_STAGES[3].description, /TikTok.*en su app/)
  assert.match(styles, /focus-visible/)
  assert.doesNotMatch(story, /addEventListener\(['"](?:wheel|touchmove)|fetch\(|axios/)
})

test('public animation presents only NexoMark, not an existing client campaign', () => {
  const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
  for (const path of ['../src/components/landing/HeroSection.jsx', '../src/components/landing/HowItWorks.jsx', '../src/components/landing/CampaignArtwork.jsx']) {
    const source = read(path)
    assert.doesNotMatch(source, /Aroma Andino|Café de origen|gallery-6|campaigns\/7|useCampaign/i)
  }
  assert.match(read('../src/components/landing/CampaignArtwork.jsx'), /\/nexomark-icon\.png/)
})
