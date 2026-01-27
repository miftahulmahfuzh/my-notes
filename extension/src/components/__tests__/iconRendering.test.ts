import { render } from '@testing-library/react';
import PopupApp from '../../popup/index';

// Mock chrome API
(global as any).chrome = {
  identity: {},
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn()
    }
  }
};

describe('Icon Rendering', () => {
  it('should render all icons without errors', async () => {
    const { container } = render(<PopupApp />);
    expect(container).toBeInTheDocument();
  });
});
