import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

test('frontend environment variables file exists and defines VITE_API_BASE_URL', () => {
  const envPath = path.resolve('.env')
  assert.ok(fs.existsSync(envPath), '.env file must exist in frontend')
  const content = fs.readFileSync(envPath, 'utf-8')
  assert.match(content, /VITE_API_BASE_URL=http:\/\/localhost:8000\/api/)
})

test('vite build output exists and contains compiled bundle', () => {
  const distHtml = path.resolve('dist/index.html')
  assert.ok(fs.existsSync(distHtml), 'dist/index.html must exist')
  const htmlContent = fs.readFileSync(distHtml, 'utf-8')
  assert.match(htmlContent, /<div id="root"><\/div>/)
})

test('frontend package scripts contain dev, build, and test', () => {
  const pkg = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf-8'))
  assert.ok(pkg.scripts.dev, 'dev script must exist')
  assert.ok(pkg.scripts.build, 'build script must exist')
  assert.ok(pkg.scripts.test, 'test script must exist')
})
