import { RouteDefinition } from '../types';

const API_BASE_URL = 'http://10.57.254.99:4000';
const ROUTES_API = `${API_BASE_URL}/api/routes`;

let routesCache: RouteDefinition[] = [];

async function fetchRoutesFromAPI(): Promise<RouteDefinition[]> {
  const res = await fetch(ROUTES_API);
  if (!res.ok) throw new Error('Failed to fetch routes');
  const data = (await res.json()) as RouteDefinition[];
  routesCache = Array.isArray(data) ? data : [];
  return routesCache;
}

async function overwriteRoutesOnAPI(routes: RouteDefinition[]): Promise<void> {
  const saveRes = await fetch(`${API_BASE_URL}/api/saveAll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: 'routes', value: routes }),
  });
  if (!saveRes.ok) throw new Error('Failed to save routes');
}

export const routeStorage = {
  getRoutes: (): RouteDefinition[] => {
    return routesCache;
  },

  getRoutesAsync: async (): Promise<RouteDefinition[]> => {
    return fetchRoutesFromAPI();
  },

  saveRoutes: (routes: RouteDefinition[]): void => {
    routesCache = routes;
    void routeStorage.saveRoutesAsync(routes);
  },

  saveRoutesAsync: async (routes: RouteDefinition[]): Promise<void> => {
    routesCache = routes;
    await overwriteRoutesOnAPI(routes);
  },

  saveRoute: (route: RouteDefinition): void => {
    const routes = routeStorage.getRoutes();
    const index = routes.findIndex(r => r.routeNumber === route.routeNumber);
    if (index !== -1) {
      routes[index] = route;
    } else {
      routes.push(route);
    }
    routeStorage.saveRoutes(routes);
  },

  addRoute: (route: RouteDefinition): void => {
    const routes = routeStorage.getRoutes();
    routes.push(route);
    routeStorage.saveRoutes(routes);
  },

  addRouteAsync: async (route: RouteDefinition): Promise<void> => {
    const routes = await routeStorage.getRoutesAsync();
    routes.push(route);
    await routeStorage.saveRoutesAsync(routes);
  },

  updateRoute: (updatedRoute: RouteDefinition): void => {
    const routes = routeStorage.getRoutes();
    const index = routes.findIndex(r => r.routeNumber === updatedRoute.routeNumber);
    if (index !== -1) {
      routes[index] = updatedRoute;
      routeStorage.saveRoutes(routes);
    }
  },

  updateRouteAsync: async (updatedRoute: RouteDefinition): Promise<void> => {
    const routes = await routeStorage.getRoutesAsync();
    const index = routes.findIndex(r => r.routeNumber === updatedRoute.routeNumber);
    if (index !== -1) {
      routes[index] = updatedRoute;
      await routeStorage.saveRoutesAsync(routes);
    }
  },

  deleteRoute: (routeNumber: string): void => {
    const routes = routeStorage.getRoutes().filter(r => r.routeNumber !== routeNumber);
    routeStorage.saveRoutes(routes);
  },

  deleteRouteAsync: async (routeNumber: string): Promise<void> => {
    const routes = await routeStorage.getRoutesAsync();
    const filtered = routes.filter(r => r.routeNumber !== routeNumber);
    await routeStorage.saveRoutesAsync(filtered);
  },

  getRouteByNumber: (routeNumber: string): RouteDefinition | undefined => {
    return routeStorage.getRoutes().find(r => r.routeNumber === routeNumber);
  },

  refreshFromServer: async (): Promise<RouteDefinition[]> => {
    return fetchRoutesFromAPI();
  }
};

export default routeStorage;
