#!/usr/bin/env node

const { Command } = require('commander')
const fs = require('fs-extra')
const path = require('path')
const axios = require('axios')
const yaml = require('js-yaml')
// Import the build function
const { buildExam } = require('./src/scripts/build.js')

const program = new Command()

program
  .name('exam-gen')
  .description('CLI to scaffold and build exam papers')
  .version('0.1.0')

program
  .command('new <examName>')
  .description('Scaffold a new exam paper structure (e.g., 2023-07-N1)')
  .action(async (examName) => {
    // Path to the specific exam's content directory
    const examContentPath = path.join(process.cwd(), 'content', examName) // Corrected: process.cwd() for base
    const sampleDataPath = path.join(examContentPath, 'data.yaml') // CHANGED to data.yaml

    try {
      if (await fs.pathExists(examContentPath)) {
        console.error(`Error: Exam '${examName}' already exists at ${examContentPath}`)
        process.exit(1) // Good: Exit if exists
      }
      await fs.ensureDir(examContentPath)

      // More comprehensive and YAML-friendly sample data
      const sampleDataYAML = `meta:
  title: ${examName} Sample Exam
  examLevel: N_LEVEL_HERE
  examDate: YYYY-MM-DD
contentFlow:
  - type: standard
    title: 問題１・サンプル
    instruction: サンプルの指示です。
    questions:
      - text: "サンプル質問１：これは<span class='underline'>何</span>ですか。"
        options:
          - "答えA"
          - "答えB"
          - "答えC"
          - "答えD"
      - text: "サンプル質問２：次の（　）に言葉を入れなさい。"
        options:
          - "選択肢１"
          - "選択肢２"
` // Note the use of `|` or `>` might be better for HTML in instruction if it gets long

      // await fs.writeJson(sampleDataPath, sampleData, { spaces: 2 }); // Old JSON way
      await fs.writeFile(sampleDataPath, sampleDataYAML) // Write YAML as a string
      console.log(`Successfully created new exam structure for '${examName}' with sample data.yaml at ${sampleDataPath}`)
    } catch (err) {
      console.error('Error creating new exam:', err.message)
      process.exit(1) // Exit on error
    }
  })

program
  .command('build [examName]')
  .description('Build a specific exam paper or all exams if no name is provided')
  .option('-o, --output <dir>', 'Specify output directory (relative to project root)', 'dist')
  .action(async (examName, options) => {
    const contentDir = path.join(process.cwd(), 'content')
    const outputBaseDir = path.resolve(process.cwd(), options.output) // Resolve to absolute path

    if (examName) {
      // Check if specific exam exists
      const specificExamPath = path.join(contentDir, examName)
      if (!await fs.pathExists(path.join(specificExamPath, 'data.yaml'))) { // Check for data.yaml
        console.error(`Error: Exam content for '${examName}' not found at ${path.join(specificExamPath, 'data.yaml')}`)
        console.log("Please make sure the exam directory and its data.yaml exist.")
        const availableExams = await listAvailableExams(contentDir)
        if (availableExams.length > 0) {
          console.log("\nAvailable exams to build:")
          availableExams.forEach(exam => console.log(`  ${exam}`))
        }
        process.exit(1)
      }
      console.log(`Building exam: ${examName} into ${outputBaseDir}`)
      await buildExam(examName, options.output) // build.js expects relative output from project root
    } else {
      console.log(`Building all exams in ${contentDir} into ${outputBaseDir}...`)
      try {
        const exams = await fs.readdir(contentDir)
        let builtAny = false
        for (const exam of exams) {
          const examPath = path.join(contentDir, exam)
          // Check if it's a directory and contains data.yaml
          if ((await fs.stat(examPath)).isDirectory()) {
            if (await fs.pathExists(path.join(examPath, 'data.yaml'))) { // Check for data.yaml
              console.log(`\n--- Building ${exam} ---`)
              await buildExam(exam, options.output) // build.js expects relative output
              builtAny = true
            } else {
              // Optional: console.warn(`Skipping ${exam}: no data.yaml found.`);
            }
          }
        }
        if (builtAny) {
          console.log('\nAll specified exams built successfully.')
        } else {
          console.log('No exams found to build in the content directory.')
        }
      } catch (error) {
        console.error('Error building all exams:', error)
        process.exit(1) // Exit on error when building all
      }
    }
  })

// Helper function to list available exams
async function listAvailableExams(contentDir) {
  try {
    const entries = await fs.readdir(contentDir)
    const examDirs = []
    for (const entry of entries) {
      const entryPath = path.join(contentDir, entry)
      if ((await fs.stat(entryPath)).isDirectory() && await fs.pathExists(path.join(entryPath, 'data.yaml'))) {
        examDirs.push(entry)
      }
    }
    return examDirs
  } catch (err) {
    // console.warn("Could not list available exams, content directory might not exist.");
    return []
  }
}

/**
 * Shuffles an array in place using the Fisher-Yates algorithm.
 * @param {Array} array The array to shuffle.
 * @returns {Array} The shuffled array (same instance).
 */
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]] // ES6 swap
  }
  return array
}

program
  .command('shuffle <examName>')
  .description('Shuffle options for all questions in a given exam\'s data.yaml file.')
  .option('-b, --backup', 'Create a backup of the original data.yaml file before shuffling.')
  .action(async (examName, options) => {
    const contentDir = path.join(process.cwd(), 'content')
    const examDataPath = path.join(contentDir, examName, 'data.yaml')

    console.log(`Shuffling options for exam: ${examName}`)

    if (!await fs.pathExists(examDataPath)) {
      console.error(`Error: Exam data file not found for '${examName}' at ${examDataPath}`)
      process.exit(1)
    }

    if (options.backup) {
      const backupPath = path.join(contentDir, examName, `data.backup-${Date.now()}.yaml`)
      try {
        await fs.copyFile(examDataPath, backupPath)
        console.log(`Backup created at: ${backupPath}`)
      } catch (backupError) {
        console.error(`Error creating backup for ${examDataPath}:`, backupError.message)
        // Decide if you want to proceed without backup or exit
        // For safety, let's exit if backup fails
        process.exit(1)
      }
    }

    try {
      const fileContents = await fs.readFile(examDataPath, 'utf8')
      const examData = yaml.load(fileContents)

      if (!examData || !examData.contentFlow || !Array.isArray(examData.contentFlow)) {
        console.error('Error: Invalid exam data structure. Missing "contentFlow" array.')
        process.exit(1)
      }

      let questionsWithOptionsShuffled = 0

      // Recursive function to find and shuffle options
      function traverseAndShuffleOptions(obj) {
        if (Array.isArray(obj)) {
          obj.forEach(traverseAndShuffleOptions)
        } else if (typeof obj === 'object' && obj !== null) {
          if (obj.options && Array.isArray(obj.options) && obj.options.every(opt => typeof opt === 'string')) {
            // Found an 'options' array of strings, shuffle it
            shuffleArray(obj.options)
            questionsWithOptionsShuffled++
          } else if (obj.choices && Array.isArray(obj.choices) && obj.choices.every(choice => typeof choice === 'string')) {
            // Also shuffle 'choices' for passageFill type
            shuffleArray(obj.choices)
            questionsWithOptionsShuffled++ // Count these as well if they represent choices for a question/blank
          }
          // Continue traversing for nested structures
          Object.keys(obj).forEach(key => traverseAndShuffleOptions(obj[key]))
        }
      }

      traverseAndShuffleOptions(examData.contentFlow)

      if (questionsWithOptionsShuffled > 0) {
        const updatedYaml = yaml.dump(examData, { indent: 2, lineWidth: -1 }) // lineWidth -1 for no wrap
        await fs.writeFile(examDataPath, updatedYaml, 'utf8')
        console.log(`Successfully shuffled options for ${questionsWithOptionsShuffled} question(s)/blank(s) in ${examDataPath}.`)
      } else {
        console.log('No question options found to shuffle in the specified format.')
      }

    } catch (error) {
      console.error(`Error shuffling options for ${examName}:`, error.message)
      if (error.name === 'YAMLException') {
        console.error('YAML Parsing/Dumping Error Details:', error.message, 'at line', error.mark?.line)
      }
      process.exit(1)
    }
  });

program
  .command('update-assets')
  .description('Download or update external assets defined in package.json (assetsConfig)')
  .action(async () => {
    console.log('Updating external assets...')
    const packageJsonPath = path.join(process.cwd(), 'package.json')
    let packageJson
    try {
      packageJson = await fs.readJson(packageJsonPath)
    } catch (error) {
      console.error(`Error reading package.json at ${packageJsonPath}:`, error.message)
      process.exit(1)
    }

    const assetsConfig = packageJson.assetsConfig
    if (!assetsConfig || typeof assetsConfig !== 'object' || Object.keys(assetsConfig).length === 0) { // Added typeof check
      console.log('No assets defined in package.json (assetsConfig section) or invalid format. Nothing to do.')
      return
    }

    let allAssetsUpdated = true // Flag to track overall success

    for (const assetKey in assetsConfig) {
      const config = assetsConfig[assetKey]
      console.log(`\nProcessing asset: ${assetKey}`)

      if (!config || typeof config !== 'object' || !config.baseUrl || !config.destinationDir || !config.files || !Array.isArray(config.files)) { // Added typeof config check
        console.warn(`Skipping ${assetKey}: Invalid configuration (baseUrl, destinationDir, or files missing/incorrect).`)
        allAssetsUpdated = false
        continue
      }

      const destDir = path.resolve(process.cwd(), config.destinationDir) // Use resolve for absolute path
      try {
        await fs.ensureDir(destDir)
      } catch (dirError) {
        console.error(`Error creating/accessing destination directory ${destDir} for ${assetKey}:`, dirError.message)
        allAssetsUpdated = false
        continue
      }

      for (const file of config.files) {
        if (typeof file !== 'string' || file.trim() === '') { // Validate file entry
          console.warn(`  Skipping invalid file entry for ${assetKey}: ${file}`)
          allAssetsUpdated = false
          continue
        }
        const fileUrl = `${config.baseUrl.replace(/\/$/, '')}/${file.trim()}`
        const destFilePath = path.join(destDir, path.basename(file.trim())) // Use path.basename to prevent directory traversal issues

        console.log(`  Downloading ${file} from ${fileUrl}...`)
        try {
          const response = await axios({
            method: 'get',
            url: fileUrl,
            responseType: 'stream'
          })

          const writer = fs.createWriteStream(destFilePath)
          response.data.pipe(writer)

          await new Promise((resolve, reject) => {
            writer.on('finish', resolve)
            writer.on('error', (err) => {
              console.error(`    Error writing file ${destFilePath}:`, err.message)
              reject(err)
            })
            response.data.on('error', (err) => {
              console.error(`    Error in download stream for ${fileUrl}:`, err.message)
              reject(err)
            })
          })
          console.log(`    Successfully saved to ${destFilePath}`)

        } catch (downloadError) {
          allAssetsUpdated = false // Mark as failed if any download fails
          if (downloadError.isAxiosError) {
            console.error(`    Error downloading ${fileUrl}: ${downloadError.message} (Status: ${downloadError.response?.status || 'N/A'})`)
          } else {
            console.error(`    Error processing ${fileUrl}: ${downloadError.message}`)
          }
        }
      }
    }
    if (allAssetsUpdated) {
      console.log('\nAll assets processed successfully.')
    } else {
      console.warn('\nAsset update process completed, but some assets encountered errors or were skipped.')
    }
  })

// Ensure this is at the end
program.parseAsync(process.argv) // Use parseAsync for async actions
  .catch(err => {
    // This global catch might be useful for unhandled promise rejections from Commander itself,
    // but individual command actions should ideally handle their own errors and exit.
    console.error("A critical error occurred in the CLI:", err)
    process.exit(1)
  })