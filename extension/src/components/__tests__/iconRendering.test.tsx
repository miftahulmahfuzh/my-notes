import { render } from '@testing-library/react';
import PopupApp from '../../popup/index';

describe('Icon Rendering', () => {
  it('should render all icons without errors', async () => {
    const { container } = render(<PopupApp />);
    expect(container).toBeInTheDocument();
  });
});
