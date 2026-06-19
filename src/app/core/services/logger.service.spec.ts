import {LoggerService} from './logger.service';

describe('LoggerService', () => {
  let service: LoggerService;

  const setDevMode = (value: boolean): void => {
    Reflect.set(globalThis as Record<string, unknown>, 'ngDevMode', value);
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    setDevMode(true);
    service = new LoggerService();
  });

  it('should log debug messages only in dev mode', () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);

    setDevMode(true);
    service.debug('visible');
    setDevMode(false);
    service.debug('hidden');

    expect(debugSpy).toHaveBeenCalledTimes(1);
    expect(debugSpy).toHaveBeenCalledWith('visible');
  });

  it('should log info messages only in dev mode', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    setDevMode(true);
    service.info('visible');
    setDevMode(false);
    service.info('hidden');

    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy).toHaveBeenCalledWith('visible');
  });

  it('should always log warning messages', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    service.warn('warning');

    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy).toHaveBeenCalledWith('warning');
  });

  it('should always log error messages', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    service.error('error');

    expect(errorSpy).toHaveBeenCalledOnce();
    expect(errorSpy).toHaveBeenCalledWith('error');
  });
});
