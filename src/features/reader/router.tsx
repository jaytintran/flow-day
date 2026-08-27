import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { HomePage } from "@/pages/HomePage";
import { CollectionPage } from "@/pages/CollectionPage";
import { SmartViewPage } from "@/pages/SmartViewPage";
import { ReaderPage } from "@/pages/ReaderPage";

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: "/", element: <HomePage viewLabel="Home" /> },
      { path: "/favorites", element: <HomePage viewLabel="Favorites" /> },
      {
        path: "/currently-reading",
        element: <HomePage viewLabel="Currently Reading" />,
      },
      { path: "/wanna-read", element: <HomePage viewLabel="Wanna Read" /> },
      { path: "/finished", element: <HomePage viewLabel="Finished" /> },
      { path: "/collections/:id", element: <CollectionPage /> },
      { path: "/authors", element: <SmartViewPage viewLabel="Authors" /> },
      {
        path: "/publishers",
        element: <SmartViewPage viewLabel="Publishers" />,
      },
      { path: "/tags", element: <SmartViewPage viewLabel="Tags" /> },
      { path: "/ratings", element: <SmartViewPage viewLabel="Ratings" /> },
    ],
  },
  { path: "/reader/:bookId", element: <ReaderPage /> },
]);
