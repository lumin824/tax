'use strict';

import Base from './base.js';
import fs from 'fs';
import cheerio from 'cheerio';
import _ from 'lodash';

import JsdsAPI from '../sysapi/jsds';
import JsgsAPI from '../sysapi/jsgs';

export default class extends Base {
  /**
   * index action
   * @return {Promise} []
   */
  async indexAction(){
    let filepath = '/Users/lumin/Documents/江苏企业库1/数据1/全省纳税人查询1.files/sheet001.htm';
    let textContent = fs.readFileSync(filepath);

    let $ = cheerio.load(textContent);
    let trList = $('table tr').toArray().slice(1);

    for (let i = 0; i < trList.length; i++){
      if(i<202) continue;
      let o = trList[i];
      let gs_api = new JsdsAPI(),
          ds_api = new JsgsAPI();

      let $td = $('td', o);
      let username = $td.eq(2).text();
      let gs_result = await gs_api.login(username, '123456'),
          ds_result = await ds_api.login(username, '123456');

      let errcnt = 0;
      while(gs_result.errno == 'ERR_03' && errcnt < 5){gs_result = await gs_api.login(username, '123456');errcnt++};
      errcnt = 0;
      while(ds_result.errno == 'ERR_03' && errcnt < 5){gs_result = await ds_api.login(username, '123456');errcnt++};

      console.log(`${i}:${username}\t${gs_result.errno}\t${gs_result.errmsg}\t${ds_result.errno}\t${ds_result.errmsg}`);

    }
    console.log('---over---');
    return this.success();
  }
}
