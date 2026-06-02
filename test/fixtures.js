// EXAMPLE payloads matching Robinhood's API SHAPES — not real account data.
// Symbols/values are illustrative; the account number is a placeholder.
const ACCT = 'ACCT0001';

export const equityCaptures = [
  { url: `https://api.robinhood.com/positions/?account_number=${ACCT}&nonzero=true`, body: {
    next: 'https://api.robinhood.com/positions/?cursor=page2', previous: null, results: [
      { url: 'https://api.robinhood.com/positions/ACC/aapl-id/', instrument: 'https://api.robinhood.com/instruments/aapl-id/', instrument_id: 'aapl-id', symbol: 'AAPL', average_buy_price: '150.0000', quantity: '10.00000000', type: 'long' },
      { instrument_id: 'zero-id', symbol: 'CLOSED', average_buy_price: '0', quantity: '0.00000000', type: 'long' },
    ] } },
  { url: `https://api.robinhood.com/positions/?account_number=${ACCT}&cursor=page2`, body: {
    next: null, previous: '...', results: [
      { instrument_id: 'msft-id', symbol: 'MSFT', average_buy_price: '300.0000', quantity: '5.00000000', type: 'long' },
    ] } },
];

export const optionCaptures = [
  { url: `https://api.robinhood.com/options/aggregate_positions/?account_numbers=${ACCT}&nonzero=True`, body: {
    next: null, previous: null, results: [
      { id: 'agg1', symbol: 'AAPL', strategy: 'long_call', average_open_price: '500.0000', quantity: '1.0000', trade_value_multiplier: '100.0000', direction: 'debit',
        legs: [{ position_type: 'long', option: 'https://api.robinhood.com/options/instruments/aapl-c/', expiration_date: '2027-01-15', strike_price: '200.0000', option_type: 'call', ratio_quantity: 1 }] },
      { id: 'agg2', symbol: 'MSFT', strategy: 'short_call', average_open_price: '300.0000', quantity: '2.0000', trade_value_multiplier: '100.0000', direction: 'credit',
        legs: [{ position_type: 'short', option: 'https://api.robinhood.com/options/instruments/msft-c/', expiration_date: '2026-07-17', strike_price: '400.0000', option_type: 'call', ratio_quantity: 1 }] },
    ] } },
];

export const legendOptionCaptures = [
  { url: `https://api.robinhood.com/options/positions/?account_numbers=${ACCT}&nonzero=true`, body: { next: null, previous: null, results: [
    { id: 'p1', chain_symbol: 'SPY', type: 'long', quantity: '4.0000', average_price: '300.0000', expiration_date: '2026-07-17', trade_value_multiplier: '100.0000', option: 'https://api.robinhood.com/options/instruments/spy-c/', option_id: 'spy-c' },
    { id: 'p2', chain_symbol: 'MSFT', type: 'short', quantity: '2.0000', average_price: '-400.0000', expiration_date: '2026-07-17', trade_value_multiplier: '100.0000', option: 'https://api.robinhood.com/options/instruments/msft-c2/', option_id: 'msft-c2' },
  ] } },
  { url: `https://api.robinhood.com/options/positions/?account_numbers=${ACCT}&nonzero=true&v=2`, body: { next: null, previous: null, results: [
    { id: 'p1', chain_symbol: 'SPY', type: 'long', quantity: '4.0000', average_price: '300.0000', expiration_date: '2026-07-17', trade_value_multiplier: '100.0000', option: 'https://api.robinhood.com/options/instruments/spy-c/', option_id: 'spy-c' },
  ] } },
  { url: 'https://api.robinhood.com/options/instruments/?ids=spy-c,msft-c2', body: { results: [
    { id: 'spy-c', url: 'https://api.robinhood.com/options/instruments/spy-c/', chain_symbol: 'SPY', strike_price: '500.0000', type: 'call', expiration_date: '2026-07-17' },
    { id: 'msft-c2', url: 'https://api.robinhood.com/options/instruments/msft-c2/', chain_symbol: 'MSFT', strike_price: '350.0000', type: 'call', expiration_date: '2026-07-17' },
  ] } },
];

export const cryptoCaptures = [
  { url: `https://nummus.robinhood.com/holdings/?nonzero=true&rhs_account_number=${ACCT}`, body: { next: null, previous: null, results: [] } },
  { url: 'https://nummus.robinhood.com/holdings/?nonzero=true&account_id=acct-uuid', body: {
    next: null, previous: null, results: [
      { id: 'h1', currency_pair_id: 'pair-btc', quantity: '0.10000000', currency: { code: 'BTC', name: 'Bitcoin' }, cost_bases: [{ direct_cost_basis: '10000.00', direct_quantity: '0.10000000' }] },
      { id: 'h2', currency_pair_id: 'pair-eth', quantity: '2.00000000', currency: { code: 'ETH', name: 'Ethereum' }, cost_bases: [{ direct_cost_basis: '4000.00', direct_quantity: '2.00000000' }] },
    ] } },
];

export const accountCaptures = [
  { url: 'https://api.robinhood.com/accounts/?default_to_all_accounts=true', body: { results: [
    { account_number: ACCT, cash: '4000.0000', portfolio_cash: '5000.0000', unsettled_funds: '1000.0000', buying_power: '20000.0000' },
  ] } },
];
