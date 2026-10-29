import { render, screen } from '@testing-library/react-native';

import App from './App';

describe('App', () => {
  it('pokazuje nazwę aplikacji', async () => {
    await render(<App />);
    expect(screen.getByText('FriendPump')).toBeTruthy();
  });
});
