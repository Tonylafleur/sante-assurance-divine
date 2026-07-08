/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  "#e3f0fb",
          100: "#b9d8f5",
          200: "#8bbfee",
          300: "#5ba5e7",
          400: "#3892e2",
          500: "#1565C0",  // Bleu principal de la plaque
          600: "#1258a8",
          700: "#0d4990",
          800: "#083a78",
          900: "#042a60",
        },
        secondary: {
          50:  "#e0f5f0",
          100: "#b3e6da",
          200: "#80d6c2",
          300: "#4dc6aa",
          400: "#26b997",
          500: "#00897B",  // Vert teal de la plaque
          600: "#007a6e",
          700: "#006860",
          800: "#005751",
          900: "#003d3a",
        },
        accent: {
          50:  "#fffde7",
          100: "#fff9c4",
          200: "#fff59d",
          300: "#fff176",
          400: "#ffee58",
          500: "#F9A825",  // Jaune de la plaque
          600: "#f57f17",
          700: "#e65100",
          800: "#bf360c",
          900: "#7f2500",
        },
        urgence: {
          vert:   "#4caf50",
          jaune:  "#ff9800",
          orange: "#ff5722",
          rouge:  "#f44336",
        }
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      }
    },
  },
  plugins: [],
};
