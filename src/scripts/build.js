const pug = require('pug')
const sass = require('sass')
const fs = require('fs-extra')
const path = require('path')
const yaml = require('js-yaml')

async function buildExam(examName, outputBaseDir = 'dist') { // Added outputBaseDir
  console.log(`Building exam: ${examName}...`)

  const basePath = path.join(__dirname, '..', '..') // Adjust base path to your project root
  const contentPath = path.join(basePath, 'content', examName, 'data.yaml')
  const templatesPath = path.join(basePath, 'src', 'templates')
  const scssMainPath = path.join(basePath, 'src', 'scss', 'main.scss')
  // Destination paths in dist
  const distPath = path.join(basePath, outputBaseDir, examName)
  const cssDirDist = path.join(distPath, 'css')
  const jsDirDist = path.join(distPath, 'js') // Or 'vendor' or 'lib'
  const cssOutputPath = path.join(cssDirDist, 'style.css')
  const htmlOutputPath = path.join(distPath, 'index.html')

  try {
    // 0. Ensure dist directory exists
    await fs.ensureDir(path.join(distPath, 'css'))

    // 1. Read and parse YAML content data
    console.log(`Reading YAML data from: ${contentPath}`)
    const fileContents = await fs.readFile(contentPath, 'utf8')
    const examData = yaml.load(fileContents) // <--- Use yaml.load()
    console.log('YAML data parsed successfully.')

    // 2. Compile SCSS
    console.log('Compiling SCSS...')
    const sassResult = sass.compile(scssMainPath, {
      style: 'expanded', // or 'compressed' for production
      loadPaths: [path.join(basePath, 'src', 'scss', 'partials')], // To find partials
      silenceDeprecations: ['import'], // Suppress dependency warnings
    })
    await fs.writeFile(cssOutputPath, sassResult.css)
    console.log(`CSS compiled to: ${cssOutputPath}`)

    // 3. Compile Pug template
    // The exam.pug template will likely iterate through examData.pages
    console.log('Compiling Pug template...')
    const compilePug = pug.compileFile(path.join(templatesPath, 'layouts/exam.pug'), {
      basedir: templatesPath, // Important for includes/extends within Pug
      pretty: true, // For readable HTML output
    })
    const html = compilePug({
      exam: examData, // Pass all data to the template
      examName: examName,
      cssPath: `./css/style.css`, // Relative path for the HTML
      pagedJsPath: `./js/paged.polyfill.js`, // Relative path to copied polyfill
    })
    await fs.writeFile(htmlOutputPath, html)
    console.log(`HTML generated at: ${htmlOutputPath}`)

    console.log(`Build for ${examName} complete! Output in ${distPath}`)
  } catch (error) {
    console.error(`Error building ${examName}:`, error)
  }
}

// --- CLI for build script (can be integrated into cli.js or run separately) ---
async function main() {
  const args = process.argv.slice(2)
  if (args.length === 0) {
    console.error("Please provide an exam name to build (e.g., 2022-12-N2)")
    console.log("Example: node src/scripts/build.js 2022-12-N2")
    // Or, you could list available exams in content/
    const exams = await fs.readdir(path.join(process.cwd(), 'content')).catch(() => [])
    if (exams.length > 0) {
      console.log("\nAvailable exams to build:")
      exams.forEach(exam => {
        if (fs.statSync(path.join(process.cwd(), 'content', exam)).isDirectory()) {
          console.log(`  ${exam}`)
        }
      })
    }
    process.exit(1)
  }
  const examName = args[0]
  await buildExam(examName)
}

if (require.main === module) {
  main()
}

module.exports = { buildExam } // For potential programmatic use