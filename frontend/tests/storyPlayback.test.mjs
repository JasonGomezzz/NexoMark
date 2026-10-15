import test from 'node:test'
import assert from 'node:assert/strict'
import { createStoryPlayback } from '../src/components/landing/storyPlayback.js'
import { remainingStoryDuration, storyCycleTiming } from '../src/components/landing/campaignStory.js'

function fixture() {
  let progress = 0
  const animations = []
  const player = createStoryPlayback({
    getProgress: () => progress,
    setProgress: value => { progress = value },
    animateToEnd: finish => {
      const control = { stopped: false, finish, stop() { this.stopped = true } }
      animations.push(control)
      return control
    },
  })
  return { player, animations, getProgress: () => progress, tick: value => { progress = value } }
}

test('autoplay starts on first visibility, not while off screen', () => {
  const { player, animations } = fixture()
  assert.equal(player.getSnapshot(), 'ready')
  player.setVisible(false)
  assert.equal(animations.length, 0)
  player.setVisible(true)
  assert.equal(player.getSnapshot(), 'playing')
  player.setVisible(true)
  assert.equal(animations.length, 1)
})

test('pause and resume retain the exact position and cancel old playback', () => {
  const { player, animations, tick, getProgress } = fixture()
  player.setVisible(true)
  tick(.36)
  player.pause()
  assert.equal(player.getSnapshot(), 'paused')
  assert.equal(animations[0].stopped, true)
  assert.equal(getProgress(), .36)
  animations[0].finish()
  assert.equal(player.getSnapshot(), 'paused')
  player.play()
  assert.equal(player.getSnapshot(), 'playing')
  assert.equal(getProgress(), .36)
})

test('leaving viewport or hiding the tab suspends without consuming the rest', () => {
  const { player, animations, tick, getProgress } = fixture()
  player.setVisible(true)
  tick(.51)
  player.setVisible(false)
  assert.equal(player.getSnapshot(), 'suspended')
  assert.equal(animations[0].stopped, true)
  player.setVisible(true)
  assert.equal(player.getSnapshot(), 'playing')
  assert.equal(getProgress(), .51)
  assert.equal(animations.length, 2)
})

test('a deliberate pause survives leaving and re-entering the section', () => {
  const { player, animations } = fixture()
  player.setVisible(true)
  player.pause()
  player.setVisible(false)
  player.setVisible(true)
  assert.equal(player.getSnapshot(), 'paused')
  assert.equal(animations.length, 1)
})

test('completed cycles restart automatically while the section remains visible', () => {
  const { player, animations, getProgress } = fixture()
  player.setVisible(true)
  animations[0].finish()
  assert.equal(player.getSnapshot(), 'playing')
  assert.equal(getProgress(), 0)
  assert.equal(animations.length, 2)
  animations[1].finish()
  assert.equal(animations.length, 3)
  assert.equal(getProgress(), 0)
  player.setVisible(false)
  assert.equal(animations[2].stopped, true)
  player.setVisible(true)
  assert.equal(player.getSnapshot(), 'playing')
  assert.equal(animations.length, 4)
})

test('manual chapter selection pauses at that position and ignores stale completion', () => {
  const { player, animations, getProgress } = fixture()
  player.setVisible(true)
  player.seek(.61)
  animations[0].finish()
  assert.equal(getProgress(), .61)
  assert.equal(player.getSnapshot(), 'paused')
  player.seek(2)
  assert.equal(getProgress(), 1)
  player.seek(NaN)
  assert.equal(getProgress(), 0)
})

test('effect cleanup stops animation and allows safe Strict Mode resubscription', () => {
  const { player, animations } = fixture()
  let updates = 0
  const unsubscribe = player.subscribe(() => { updates += 1 })
  player.setVisible(true)
  player.setVisible(false)
  assert.equal(animations[0].stopped, true)
  player.setVisible(true)
  assert.equal(player.getSnapshot(), 'playing')
  assert.equal(updates, 3)
  unsubscribe()
  player.pause()
  assert.equal(updates, 3)
})

test('resuming uses only the remaining part of the fourteen-second timeline', () => {
  assert.equal(remainingStoryDuration(0), 14)
  assert.equal(remainingStoryDuration(.5), 7)
  assert.equal(remainingStoryDuration(1), 0)
  assert.equal(remainingStoryDuration(2), 0)
  assert.equal(remainingStoryDuration(-1), 14)
  assert.equal(remainingStoryDuration(NaN), 14)
})

test('each cycle holds the completed scene for two seconds before restarting', () => {
  assert.deepEqual(storyCycleTiming(0), { duration: 16, times: [0, .875, 1] })
  assert.deepEqual(storyCycleTiming(.5), { duration: 9, times: [0, 7 / 9, 1] })
})

test('pausing at the end prevents another cycle until explicitly resumed', () => {
  const { player, animations, tick, getProgress } = fixture()
  player.setVisible(true)
  tick(1)
  player.pause()
  animations[0].finish()
  assert.equal(player.getSnapshot(), 'paused')
  assert.equal(animations.length, 1)
  player.setVisible(false)
  player.setVisible(true)
  assert.equal(player.getSnapshot(), 'paused')
  player.play()
  assert.equal(player.getSnapshot(), 'playing')
  assert.equal(getProgress(), 0)
  assert.equal(animations.length, 2)
})
