import { afterEach, describe, expect, it, vi } from 'vitest';
import { Logger, logger, withLogger } from './logger.js';

afterEach(() => vi.restoreAllMocks());

describe('Logger', () => {
  it('writes every level by default, and steps only when verbose', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const quiet = new Logger();
    quiet.info('a');
    quiet.error('b');
    quiet.success('c');
    quiet.header('d');
    quiet.step('hidden');
    expect(spy).toHaveBeenCalledTimes(4);
    new Logger({ verbose: true }).step('shown');
    expect(spy).toHaveBeenCalledTimes(5);
  });

  it('stays silent when quiet', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    new Logger({ quiet: true }).info('nope');
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('logger()', () => {
  it('defaults to printing only prefixed errors', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    logger().info('quiet');
    logger().error('loud');
    expect(log).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith('[saykit]', 'loud');
  });

  it('is the logger of the enclosing run', () => {
    const own = new Logger({ quiet: true });
    expect(withLogger(own, () => logger())).toBe(own);
  });
});
