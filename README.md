<div align="center">
  <img src="/assets/logo.png" alt="Terravue Logo" width="300">
</div>
<p align="center">Terravue is an environmental metrics visualizer of web applications and services.</p>

---

## Features

- Environmental metrics visualization

## Development

1. Clone the repository:
   ```bash
   git clone https://github.com/TerraVueDev/browser-extension.git
   cd browser-extension
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Generate TailwindCSS:

   ```bash
   npx @tailwindcss/cli -i ./assets/css/input.css -o ./assets/css/output.css --minify
   ```

4. Enable developer mode on Chrome extension tab then click 'Load unpacked' and choose browser-extension directory.

## Contributing

Contributions are welcome! Please open issues or submit pull requests.
