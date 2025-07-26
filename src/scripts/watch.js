const chokidar = require('chokidar')
const path = require('path')
const fs = require('fs-extra') // Ensure you have fs-extra installed
const { exec } = require('child_process')
const { buildExam } = require('./build.js') // Assuming build.js is in the same dir

const contentDir = path.join(process.cwd(), 'content')
const srcDir = path.join(process.cwd(), 'src')
const defaultExamToWatch = '2022-12-N2' // Or get from args, or watch all

console.log(`Watching for changes in ${srcDir} and ${contentDir}...`)
console.log(`Will rebuild '${defaultExamToWatch}' on changes. Modify 'defaultExamToWatch' in watch.js if needed.`)

// Debounce function to prevent rapid rebuilds
function debounce(func, wait) {
  let timeout
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

const rebuild = debounce(async () => {
  console.log('Changes detected, rebuilding...')
  // Determine which exam to build. For simplicity, rebuild a default or all.
  // A more advanced setup could try to figure out which exam was affected.
  try {
    // Rebuild a specific exam (e.g., the one you are working on)
    // You might pass the exam name as an argument to the watch script
    const examName = process.argv[2] || defaultExamToWatch // Get exam name from arg or use default
    if (await fs.pathExists(path.join(contentDir, examName, 'data.json'))) {
      console.log(`Rebuilding ${examName}...`)
      await buildExam(examName) // buildExam(examName, 'dist') if you use custom output
    } else {
      console.warn(`Cannot rebuild ${examName}: data.json not found. Please specify a valid exam to watch.`)
    }

    // Or rebuild all
    // const exams = await fs.readdir(contentDir);
    // for (const exam of exams) { /* ... build logic ... */ }
  } catch (error) {
    console.error("Error during rebuild:", error)
  }
}, 500) // 500ms debounce

chokidar.watch([`${srcDir}/**/*.*`, `${contentDir}/**/*.json`], {
  ignored: /(^|[\/\\])\../, // ignore dotfiles
  persistent: true,
  ignoreInitial: true // Don't run on initial startup, only on changes
}).on('all', (event, filePath) => {
  console.log(`[${event}] ${filePath}`)
  rebuild()
});

// Initial build when watch starts
(async () => {
  const initialExam = process.argv[2] || defaultExamToWatch
  if (await fs.pathExists(path.join(contentDir, initialExam, 'data.json'))) {
    console.log(`Performing initial build for ${initialExam}...`)
    await buildExam(initialExam)
  } else {
    console.warn(`Cannot perform initial build for ${initialExam}: data.json not found. Please specify a valid exam to watch or create content.`)
  }
})()