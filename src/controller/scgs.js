'use strict';

import Base from './sysbase.js';

import cheerio from 'cheerio';
import _ from 'lodash';

let getJKPZ = (httpClient, p) => new Promise((resolve, reject)=>{
  httpClient.get('http://wsbs.sc-n-tax.gov.cn/invoice/jkpz.htm', {qs:{p}}, (error, response, body)=>{
    if(error) reject(error);
    let $ = cheerio.load(body);
    resolve(_.map($('#theObjTable tbody tr'), o=>{
      let tds = $('td', o);
      if(_.size(tds) == 1) return {};
      return {
        pzhm: tds.eq(0).text(),
        sz: tds.eq(1).text(),
        sm: tds.eq(2).text(),
        zsl: tds.eq(3).text(),
        sssq: tds.eq(4).text(),
        sjje: tds.eq(5).text()
      }
    }));
  });
});

export default class extends Base {

  async indexAction(){
    let httpClient = await this.getOrCreateHttpClient();
    if(this.isAjax()){
      let { username:userName, password, captcha:vcode } = this.param();
      let form = {userName, password, vcode, dlfs:1 };
      let result = await new Promise((resolve, reject)=>{
        httpClient.post('http://wsbs.sc-n-tax.gov.cn/op_login.htm', {form}, (error, response, body)=>{
          if(error)reject(error);
          else{
            resolve(JSON.parse(body));
          }

        });
      });
      if(result.code){
        this.fail(result.code, result.mesg);
      }else{
        this.success({redirect1:'/scgs/show'});
      }
    }
    else{
      let result = await new Promise((resolve, reject)=>{
        httpClient.get('http://wsbs.sc-n-tax.gov.cn/', (error, response, body)=>{
          if(error)reject(error);
          else{
            resolve(body);
          }
        });
      });
      this.assign({
        result
      })
      return this.display();
    }
  }

  async captchaAction(){
    let httpClient = await this.getOrCreateHttpClient();
    httpClient.get('http://wsbs.sc-n-tax.gov.cn/vcode').pipe(this.http.res);
  }

  async showAction(){
    let httpClient = await this.getOrCreateHttpClient();
    let dataList = [];
    for(let i = 1; i <= 100; i++){
      let list = await getJKPZ(httpClient, i);
      if(!_.size(list[0])) break;
      dataList.push(...list);
    }
    let qyjbxx = await new Promise((resolve, reject)=>{
      httpClient.get('http://wsbs.sc-n-tax.gov.cn/inc/intoWssb.htm', (error, response, body)=>{
        if(error)reject(error);
        else{
          let $ = cheerio.load(body);
          console.log(body);
          console.log($('#qyjbxxDiv').text());
          resolve(JSON.parse($('#qyjbxxDiv').text()));
        }
      });
    });
    this.assign({dataList, qyjbxx});
    return this.display();
  }
}
