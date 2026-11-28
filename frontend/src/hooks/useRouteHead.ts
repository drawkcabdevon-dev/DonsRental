import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface RouteMeta {
  title: string;
  description: string;
  robots: string;
}

interface SeoConfig {
  siteUrl: string;
  defaultRobots: string;
  routes: Record<string, RouteMeta>;
}

const FALLBACK_CONFIG: SeoConfig = {
  siteUrl: 'https://rentals.onlineverywhere.com',
  defaultRobots: 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1',
  routes: {
    '/': {
      title: "Don's Rental | Affordable Car Rental in Barbados | Suzuki Swift",
      description: "Don's Rental offers affordable, hassle-free car rentals in Barbados. Book the Suzuki Swift online today for the best rates on the island.",
      robots: 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1',
    },
  },
};

let configPromise: Promise<SeoConfig> | null = null;

function loadConfig(): Promise<SeoConfig> {
  if (!configPromise) {
    configPromise = fetch('/seo-routes.json')
      .then((response) => (response.ok ? response.json() as Promise<SeoConfig> : Promise.reject(new Error('SEO config unavailable'))))
      .catch(() => FALLBACK_CONFIG);
  }
  return configPromise;
}

function setMeta(attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function applyHead(config: SeoConfig, pathname: string) {
  const route = config.routes[pathname] ?? config.routes['/'];
  if (!route) return;

  const canonical = new URL(pathname, `${config.siteUrl}/`).toString();
  const siteName = "Don's Rental";

  document.title = route.title;
  setMeta('name', 'description', route.description);
  setMeta('name', 'robots', route.robots);
  setMeta('property', 'og:title', route.title);
  setMeta('property', 'og:description', route.description);
  setMeta('property', 'og:url', canonical);
  setMeta('property', 'og:site_name', siteName);
  setMeta('name', 'twitter:title', route.title);
  setMeta('name', 'twitter:description', route.description);

  let canonicalLink = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonicalLink) {
    canonicalLink = document.createElement('link');
    canonicalLink.rel = 'canonical';
    document.head.appendChild(canonicalLink);
  }
  canonicalLink.href = canonical;
}

export function useRouteHead() {
  const { pathname } = useLocation();

  useEffect(() => {
    let active = true;
    loadConfig().then((config) => {
      if (active) applyHead(config, pathname);
    });
    return () => {
      active = false;
    };
  }, [pathname]);
}
