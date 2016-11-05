'use strict';

import Base from './base.js';
import request from 'request';
import _ from 'lodash';
import cheerio from 'cheerio';

export default class extends Base {
  async indexAction(){
    let { keyword } = this.param();
    if(keyword){
      let form = {
        keyword,searchtype:'0',objectType:'2',areas:'',creditType:'',
        dataType:'1',areaCode:'',templateId:'',exact:'0',page:'1'
      };
      let headers = { 'User-Agent':'request', 'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8' };

      let fetchFunc = (page)=> new Promise((resolve, reject)=>{
        request.post('http://www.creditchina.gov.cn/credit_info_search',{
          form:{...form, page},headers
        },(error, response, body)=>{
          if(error) reject(error);
          else resolve(JSON.parse(body));
        });
      });

      let result = await fetchFunc('1');

      if(result.result.totalPageCount > 1){
        let pageNumList = [];
        for(let i = 2; i <= result.result.totalPageCount && i<=5;i++){
          pageNumList.push(i);
        }
        result = [result];
        result = result.concat(await Promise.all(_.map(pageNumList, async o=>fetchFunc(o))));
      }else{
        result = [result];
      }

      result = _.flatten(_.map(result, 'result.results'));
      this.assign('result', result);

    }
    return this.display();
  }

  async detailAction(){
    let { objectType, encryStr } = this.param();

    let result = await new Promise((resolve, reject)=>{
      request.get('http://www.creditchina.gov.cn/credit_info_detail', {
        qs: { objectType, encryStr},
        headers: { 'User-Agent':'request' }
      }, (error, response, body)=>{
        //console.log(body);
        if(error) reject(error);
        else{
          let $ = cheerio.load(body);

          let infos = _.map($('div.creditsearch-tagsinfo').toArray(),
            o=>_.map($(o).find('ul.creditsearch-tagsinfo-ul').toArray(),
              o2=>_.map($(o2).find('li.oneline').toArray(),
                o3=>_.trim($(o3).text())
              )
            )
          );
          let oneline = $('li.oneline').map((o,v)=>$(v).text());
          resolve({
            body,
            infos
          })
        }resolve(body);
      });
    });

    let schmd = _.map(result.infos[3], o=>{
      let ah = _.find(o,o2=>_.startsWith(o2,'案号'));
      let frxm = _.find(o,o2=>_.startsWith(o2,'企业法人姓名'));
      let qdyw = _.find(o,o2=>_.startsWith(o2,'法律生效文书确定的义务'));
      let je = 0;
      let m = qdyw.match(/(\d+(?:\.\d+)?)(元|万元)/);
      if(m){
        je = parseFloat(m[1]);
        if(m[2]=='万元') je*=10000;
      }

      return { ah, qdyw, je, frxm};
    });

    let hmdje = _.sumBy(schmd, 'je');
    let hmddj = (Math.log(hmdje/1000) / Math.log(10)).toFixed(1);
    this.assign({result, schmd, hmdje, hmddj});
    return this.display();
  }
}
