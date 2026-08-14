// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { Stepper } from '@/components/ui/Stepper';
import { ConnectionBar } from '@/components/ui/ConnectionBar';
import { Countdown } from '@/components/auction/Countdown';

afterEach(cleanup);

/** jest-dom matcher'i eklemeden devre disi kontrolu. */
function expectDisabled(name: string) {
  const el = screen.getByRole('button', { name }) as HTMLButtonElement;
  expect(el.disabled, `${name} devre disi olmali`).toBe(true);
}

describe('Stepper', () => {
  it('degeri gosterir', () => {
    render(<Stepper value={5} min={5} max={6} onChange={() => {}} />);
    expect(screen.getByTestId('stepper-value').textContent).toBe('5');
  });

  it('arttirma ve azaltma birer adim degistirir', () => {
    const onChange = vi.fn();
    const { rerender } = render(<Stepper value={5} min={5} max={9} onChange={onChange} />);
    screen.getByRole('button', { name: 'Bir arttır' }).click();
    expect(onChange).toHaveBeenCalledWith(6);

    rerender(<Stepper value={6} min={5} max={9} onChange={onChange} />);
    screen.getByRole('button', { name: 'Bir azalt' }).click();
    expect(onChange).toHaveBeenLastCalledWith(5);
  });

  it('sinirlarda ilgili dugmeyi devre disi birakir', () => {
    const { rerender } = render(<Stepper value={5} min={5} max={9} onChange={() => {}} />);
    expectDisabled('Bir azalt');

    rerender(<Stepper value={9} min={5} max={9} onChange={() => {}} />);
    expectDisabled('Bir arttır');
  });

  it('MAKS dugmesi ust sinira gotururur ve sinir degerini yazar', () => {
    const onChange = vi.fn();
    render(<Stepper value={5} min={5} max={9} onChange={onChange} />);
    const max = screen.getByRole('button', { name: 'En yüksek teklif: 9' });
    expect(max.textContent).toContain('9');
    max.click();
    expect(onChange).toHaveBeenCalledWith(9);
  });

  it('devre disiyken hicbir dugme is yapmaz', () => {
    const onChange = vi.fn();
    render(<Stepper value={6} min={5} max={9} onChange={onChange} disabled />);
    for (const name of ['Bir azalt', 'Bir arttır', 'En yüksek teklif: 9']) {
      expectDisabled(name);
    }
    expect(onChange).not.toHaveBeenCalled();
  });

  it('min ve max esitse iki yon dugmesi de kapalidir', () => {
    render(<Stepper value={5} min={5} max={5} onChange={() => {}} />);
    expectDisabled('Bir azalt');
    expectDisabled('Bir arttır');
  });
});

describe('ConnectionBar', () => {
  it('baglanti saglamken hicbir sey gostermez', () => {
    render(<ConnectionBar connection="open" />);
    expect(screen.queryByTestId('connection-bar')).toBeNull();
  });

  it('baglanirken ve yeniden baglanirken uyarir', () => {
    const { rerender } = render(<ConnectionBar connection="connecting" />);
    expect(screen.getByTestId('connection-bar').textContent).toContain('BAĞLANIYOR');

    rerender(<ConnectionBar connection="reconnecting" />);
    expect(screen.getByTestId('connection-bar').textContent).toContain('YENİDEN');
  });
});

describe('Countdown', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const deadlineIn = (ms: number) => new Date(Date.now() + ms).toISOString();

  it('kalan sureyi dakika:saniye olarak gosterir', () => {
    render(
      <Countdown deadline={deadlineIn(24_000)} clockOffsetMs={0} totalSeconds={30} onExpire={() => {}} />,
    );
    expect(screen.getByTestId('countdown').textContent).toBe('0:24');
  });

  it('saniye basi geri sayar', () => {
    render(
      <Countdown deadline={deadlineIn(24_000)} clockOffsetMs={0} totalSeconds={30} onExpire={() => {}} />,
    );
    act(() => void vi.advanceTimersByTime(2000));
    expect(screen.getByTestId('countdown').textContent).toBe('0:22');
  });

  it('son bes saniyede acil isareti verir', () => {
    render(
      <Countdown deadline={deadlineIn(4_000)} clockOffsetMs={0} totalSeconds={30} onExpire={() => {}} />,
    );
    expect(screen.getByTestId('countdown').dataset.urgent).toBe('true');
  });

  it('sure dolunca sifir gosterir ve onExpire yalnizca bir kez cagrilir', () => {
    const onExpire = vi.fn();
    render(
      <Countdown deadline={deadlineIn(1_000)} clockOffsetMs={0} totalSeconds={30} onExpire={onExpire} />,
    );
    act(() => void vi.advanceTimersByTime(5000));
    expect(screen.getByTestId('countdown').textContent).toBe('0:00');
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('saat farkini duzeltir', () => {
    // Sunucu tarayicidan 10 saniye ilerideyse kalan sure 10 saniye azalir.
    render(
      <Countdown deadline={deadlineIn(24_000)} clockOffsetMs={10_000} totalSeconds={30} onExpire={() => {}} />,
    );
    expect(screen.getByTestId('countdown').textContent).toBe('0:14');
  });
});
