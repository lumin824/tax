'use strict';

import Base from './base.js';
import request from 'request';
import _ from 'lodash';
import cheerio from 'cheerio';

export default class extends Base {
  async indexAction(){
    let { keyword='',templateId='' } = this.param();

    let fetchTemplate = async (keyword, templateId)=>{
      let form = {
        keyword,searchtype:'0',objectType:'2',areas:'',creditType:'',
        dataType:'1',areaCode:'',templateId,exact:'0',page:'1'
      };
      let headers = { 'User-Agent':'request', 'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8' };

      let fetchFunc = (page)=> new Promise((resolve, reject)=>{
        console.log(form);
        console.log(page);
        request.post('http://www.creditchina.gov.cn/credit_info_search',{
          form:{...form, page},headers
        },(error, response, body)=>{
          console.log(body);
          if(error) reject(error);
          else resolve(JSON.parse(body));
        });
      });

      let result = await fetchFunc('1');

      if(result.result.totalPageCount > 1 && !templateId){
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
      return result;
    };

    let resultList = [];
    if(templateId){
      resultList = await Promise.all(_.map(templateId.split(','), async o=>fetchTemplate(keyword, o)));
    }else{
      let result = await fetchTemplate(keyword,'');
      resultList = [result];
    }


    this.assign('result', _.flatten(resultList));

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

    let fmjl = _.map(result.infos[2],o=>{
      let wfss = _.find(o,o2=>_.startsWith(o2,'主要违法事实'));
      let frxm = _.find(o,o2=>_.startsWith(o2,'法定代表人或者负责人姓名'));
      let cfqk = _.find(o,o2=>_.startsWith(o2,'相关法律依据及处理处罚情况'));
      let je = 0;
      let m = cfqk.match(/(\d+(?:\.\d+)?)(元|千元|万元|十万元|百万元|千万元|亿元)/);
      if(m){
        je = parseFloat(m[1]);
        if(m[2]=='千元')        je*=1e3;
        else if(m[2]=='万元')   je*=1e4;
        else if(m[2]=='十万元') je*=1e5;
        else if(m[2]=='百万元') je*=1e6;
        else if(m[2]=='千万元') je*=1e7;
        else if(m[2]=='亿元')   je*=1e8;
      }
      return { wfss, cfqk, je, frxm };
    });

    let schmd = _.map(result.infos[3], o=>{
      // 最高法
      let ah = _.find(o,o2=>_.startsWith(o2,'案号'));
      let frxm = _.find(o,o2=>_.startsWith(o2,'企业法人姓名'));
      let qdyw = _.find(o,o2=>_.startsWith(o2,'法律生效文书确定的义务'));
      // 财政部
      let blxw = _.find(o,o2=>_.startsWith(o2,'不良行为的具体情形'));
      let cfjg = _.find(o,o2=>_.startsWith(o2,'处罚结果'));

      let je = 0;
      let m;
      if(qdyw && (m = qdyw.match(/(\d+(?:\.\d+)?)(元|千元|万元|十万元|百万元|千万元|亿元)/))){
        je = parseFloat(m[1]);
        if(m[2]=='千元')        je*=1e3;
        else if(m[2]=='万元')   je*=1e4;
        else if(m[2]=='十万元') je*=1e5;
        else if(m[2]=='百万元') je*=1e6;
        else if(m[2]=='千万元') je*=1e7;
        else if(m[2]=='亿元')   je*=1e8;
      }else if(cfjg && (m = cfjg.match(/(\d+(?:\.\d+)?)(元|千元|万元|十万元|百万元|千万元|亿元)/))){
        je = parseFloat(m[1]);
        if(m[2]=='千元')        je*=1e3;
        else if(m[2]=='万元')   je*=1e4;
        else if(m[2]=='十万元') je*=1e5;
        else if(m[2]=='百万元') je*=1e6;
        else if(m[2]=='千万元') je*=1e7;
        else if(m[2]=='亿元')   je*=1e8;
      }
      return { ah, frxm, qdyw, blxw, cfjg, je};
    });



    let sxje = _.sumBy(fmjl, 'je') + _.sumBy(schmd, 'je');
    let sxdj = 0;
    if(sxje > 1000){
      sxdj = (Math.log(sxje/1000) / Math.log(10)).toFixed(1);
    }
    this.assign({result, fmjl, schmd, sxje, sxdj});
    return this.display();
  }
}
