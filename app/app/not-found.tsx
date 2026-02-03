import { Metadata } from "next";

export const metadata: Metadata = {
  title: "404 - Not Found",
};

export default function NotFound() {
  return (
    <html>
      <body>
        <h1>Not Found</h1>
        <p>The page you are looking for does not exist.</p>
      </body>
    </html>
  );
}
