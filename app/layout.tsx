import './design-system.css';
import BackgroundLayer from '../components/BackgroundLayer';

export const metadata = {
  title: 'Lumen',
  description: 'Lumen — connect, share, talk.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <BackgroundLayer />
        <div className="app-content">{children}</div>
      </body>
    </html>
  );
}
