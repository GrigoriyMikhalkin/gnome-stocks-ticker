'use strict';

const Soup = imports.gi.Soup;
const ExtensionUtils = imports.misc.extensionUtils;

const Me = ExtensionUtils.getCurrentExtension();
const CurrencyMap = Me.imports.currencyMap.CurrencyMap;


const BASE_URL = 'https://www.google.com/';
const PRICES_UPDATE_URL = BASE_URL + 'async/finance_wholepage_price_updates?async=mids:';
const SUGGESTIONS_URL = BASE_URL + 'complete/search?client=finance-immersive&hl=en&gl=us&gs_rn=64&q=';

var GoogleClient = class GoogleClient {
  constructor() {
    this._session = new Soup.Session({
      timeout: 10
    });
  }

  get_prices_update(financialIds, callback) {
    // Returns updated prices for financials in following format:
    // {
    //    financialId: {
    //      name: string,
    //      price: number,
    //      change: NEGATIVE | POSITIVE,
    //      percent_change: number,
    //      symbol: string,
    //      currency: string,
    //      exchange: string
    //    }
    // }

    const message = this._get_prices_update_message(financialIds);
    const inputStream = this._session.queue_message(message, (_, msg) => {
      let priceUpdates = {};
      const respBody = JSON.parse(message.response_body.data.slice(4));
      for (let e of respBody["PriceUpdate"]["entities"]) {
        let currencyCode = e['financial_entity']['currency_code'];
        priceUpdates[e["live_update_id"]["financial_id"]] = {
          name: e["financial_entity"]["common_entity_data"]["name"],
          price: e["financial_entity"]["common_entity_data"]["last_value_dbl"],
          change: e["financial_entity"]["common_entity_data"]["change"],
          percent_change: e["financial_entity"]['common_entity_data']["percent_change"].replace(' ', ''),
          symbol: e['financial_entity']['common_entity_data']['symbol'],
          currency: CurrencyMap[currencyCode] || ' ' + currencyCode,
          exchange: e['financial_entity']['exchange']
        }
      }

      callback(priceUpdates);
    });
  }

  get_suggestions(prefix, callback) {
    // Returns list of suggestion in following format:
    //   [
    //     {
    //       name: string,
    //       symbol: string,
    //       financialId: string,
    //       exchange: string
    //     }
    //   ]

    const message = this._get_suggestions_message(prefix);
    this._session.queue_message(message, (_, msg) => {
      let suggestions = [];
      const respBody = JSON.parse(message.response_body.data.slice(19, -1));
      for (let e of respBody[1]) {
        let info = e[3];
        if (!info || !info['c']) {
          continue
        }
        suggestions.push({
          name: info['c'],
          symbol: info['t'],
          financialId: info['m'],
          exchange: info['x']
        });
      }

      // Returning suggestions
      callback(suggestions);
    });
  }

  _get_prices_update_message(financialIds) {
    const message = Soup.Message.new(
      'GET',
      PRICES_UPDATE_URL + financialIds.join('|')
    );

    return message;
  }

  _get_suggestions_message(prefix) {
    const message = Soup.Message.new(
      'GET',
      SUGGESTIONS_URL + prefix
    );

    return message;
  }
}
