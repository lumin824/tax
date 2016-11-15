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
      if(result.code == 100){
        this.success({redirect:'/scgs/show'});
      }else{
        this.fail(result.code, result.mesg);
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
    console.log(0);
    let httpClient = await this.getOrCreateHttpClient();
    let dataList = [];
    for(let i = 1; i <= 100; i++){
      let list = await getJKPZ(httpClient, i);
      if(!_.size(list[0])) break;
      dataList.push(...list);
    }
    let res;
    let qyjbxx;
    res = await this.httpGet('http://wsbs.sc-n-tax.gov.cn/inc/intoWssb.htm');
    if(res.body){
      let $ = cheerio.load(res.body);
      qyjbxx = JSON.parse($('#qyjbxxDiv').text());
    }
    console.log(1);
    let sbList = [];
    res = await this.httpPost('http://shenbao.sc-n-tax.gov.cn/Cnct_Web/menus/ysbxxcx/ajax_ysbxxCx_lssbGyxx.action', {
      form:{sssq_q:'2009-11-01',sssq_z:'2016-11-30',zsxm_dm:'10104'}
    });
    if(res.body){
      sbList = JSON.parse(res.body).lssbGyxx.business.returnData;
    }

    console.log(2);
    let filterParams = [
      {sssq_z:'2016-09-30'},
      {sssq_q:'2015-01-01',sssq_z:'2015-12-31'},
      {sssq_q:'2014-01-01',sssq_z:'2014-12-31'},
      {sssq_q:'2013-01-01',sssq_z:'2013-12-31'}
    ];

    console.log(3);
    let ljyysrList = await Promise.all(_.map(filterParams, async o=>{
      let sb = _.find(sbList, o);
      let ljyysr = {};
      if(sb.pzzl_dm == 'BDA0610756'){ // A
        let url = 'http://shenbao.sc-n-tax.gov.cn/Cnct_Web/tables_print/sds/jdsdsa/ajax_ysbxxCx_ysbxxCx.action';
        let res = await this.httpPost(url, {
          form:{sbuuid:sb.sbuuid,pzzl_dm:sb.pzzl_dm}
        });
        if(res.body){
          let zb = JSON.parse(res.body).Mx.business.returnData.zbKeys;
          ljyysr = _.find(zb, {zblc:'2'});
        }
      }else if(sb.pzzl_dm == 'BDA0610764'){ // B
        let url = 'http://shenbao.sc-n-tax.gov.cn/Cnct_Web/tables_print/sds/jdsdsb/ajax_ysbxxCx_ysbxxCx.action';
        let res = await this.httpPost(url, {
          form:{sbuuid:sb.sbuuid,pzzl_dm:sb.pzzl_dm}
        });
        if(res.body){
          let zb = JSON.parse(res.body).Mx.business.returnData.zb;
          ljyysr = _.find(zb, {zblc:'1'});
        }
      }

      return {
        year:o.sssq_z.substr(0,4),
        yysr: parseFloat(ljyysr.ljje)
      };
    }));
    console.log(4);
    let jkList = [];
    res = await this.httpPost('http://shenbao.sc-n-tax.gov.cn/Cnct_Web/menus/kkgl/ajax_kkxxgl_yKkxxCx.action', {
      form:{jsrqq:'2012-01-01',jsrqz:'2017-01-01'}
    });
    if(res.body){
      jkList = JSON.parse(res.body).ykkxx.business.returnData.kkxx;

      jkList = _.map(_.groupBy(jkList, o=>o.sssq_z.substr(0,4)), (o2,k2)=>({
        year: k2,
        jk:_.sumBy(o2, o3=>parseFloat(o3.kkse))
      }));
    }
    console.log(5);
    let cc = await this.findcc(qyjbxx.nsrmc);

    let gridData = _.groupBy([{year:'2016'},{year:'2015'},{year:'2014'},{year:'2013'},...ljyysrList,...jkList], 'year');
    gridData = _.mapValues(gridData,o=>_.merge(...o));
    gridData = _.mapValues(gridData,o=>{

      return {
        lt: o.jk > 1000 ? (Math.log(o.jk/1000) / Math.log(10)).toFixed(2):0,
        c: (o.jk) ? (100*o.jk/cc.jcxx.zczj).toFixed(2):'',
        r: (o.jk&&o.yysr) ? (100*o.jk/o.yysr).toFixed(2) : '',
      }
    });

    let grid = {
      lt:[gridData['2016'].lt,gridData['2015'].lt,gridData['2014'].lt,gridData['2013'].lt],
      c:[gridData['2016'].c,gridData['2015'].c,gridData['2014'].c,gridData['2013'].c],
      r:[gridData['2016'].r,gridData['2015'].r,gridData['2014'].r,gridData['2013'].r]
    };

    this.assign({dataList, qyjbxx, grid});
    return this.display();
  }
}
