const fs = require('fs');
const readline = require('readline');

const transcriptPath = 'C:/Users/kholifah/.gemini/antigravity/brain/336bf3c6-6b0b-42d2-85de-23f7919dc5fc/.system_generated/logs/transcript_full.jsonl';
const outputPath = 'C:/Users/kholifah/.gemini/antigravity/brain/336bf3c6-6b0b-42d2-85de-23f7919dc5fc/original_plan.md';

async function processLineByLine() {
  const fileStream = fs.createReadStream(transcriptPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    if (line.includes('"name":"write_to_file"') && line.includes('implementation_plan.md')) {
      try {
        const json = JSON.parse(line);
        if (json.tool_calls && json.tool_calls.length > 0) {
          const args = json.tool_calls[0].args;
          if (args.TargetFile && args.TargetFile.includes('implementation_plan.md') && args.CodeContent) {
            fs.writeFileSync(outputPath, args.CodeContent);
            console.log("Successfully extracted original plan.");
            return; // Stop after finding the first one
          }
        }
      } catch (e) {
        console.error("Error parsing JSON:", e);
      }
    }
  }
}

processLineByLine();
