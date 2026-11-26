export function prefersLightMotion(): boolean {
  const connection = (navigator as Navigator & {
    connection?: { saveData?: boolean };
  }).connection;
  return navigator.hardwareConcurrency <= 4 || Boolean(connection?.saveData);
}
