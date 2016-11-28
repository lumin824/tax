'use strict';

import Base from './sysbase.js';
import crypto from 'crypto';
import cheerio from 'cheerio';
import _ from 'lodash';
import url from 'url';
import moment from 'moment';
import tesseract from 'node-tesseract';
import fs from 'fs';
import gm from 'gm';

export default class extends Base {
  async indexAction(){

    if(this.isAjax()){
      let { username, password, captcha } = this.param();

      let ret;
      ret = await this.httpPost('http://www.jsds.gov.cn/LoginAction.do', {
        form: { jsonData: JSON.stringify({
          handleCode:'baseLogin',
          data:{zh:username, zhPassWord:password, zhYzm: captcha}
        })}
      });

      let loginJson = JSON.parse(ret.body);
      console.log(loginJson);

      let base = {
        name:loginJson.data.LoginVO.nsrMc
      };
      ret = await this.httpGet('http://www.jsds.gov.cn/MainAction.do', {
        qs: {
          sessionId: loginJson.data.sessionId
        }
      })

      let jkxx = [];
      ret = await this.httpPost('http://www.jsds.gov.cn/JkxxcxAction.do', {
        form: {
          sbsjq:'2016-11-01',sbsjz:'2016-11-30',
          sbbzl:'',errorMessage:'',handleDesc:'查询缴款信息',handleCode:'queryData',
          cqSb:'0',sessionId:loginJson.data.sessionId
        }
      });

      if(ret.body){
        let $ = cheerio.load(ret.body);
        let $trList = $('#querytb tr').toArray().slice(1);
        jkxx = _.map($trList, (o,i)=>{

          let $tdList = $('td', o);

          return {
            sbbzl: _.trim($tdList.eq(1).text()),
            sbrq: _.trim($tdList.eq(2).text()),
            skssqq: _.trim($tdList.eq(3).text()),
            skssqz: _.trim($tdList.eq(4).text()),
            yjkje: _.trim($tdList.eq(5).text()),
            wjkje: _.trim($tdList.eq(6).text()),
            dkje: _.trim($tdList.eq(7).text()),
            hxje: _.trim($tdList.eq(8).text()),
          }
        })
      }

      console.log(jkxx);

      ret = await this.httpPost('http://www.jsds.gov.cn/wb032_WBcwbbListAction.do', {
        qs: {'sessionId':loginJson.data.sessionId},
        form: {
          sbnf:'2016',cwbbErrzt:'1',cwbbdldm:'CKL',errorMessage:'',
          swglm:loginJson.data.LoginVO.swglm, curpzxh:'',handleDesc:'',
          handleCode:'submitSave',cwbbjdqxmc:'年度终了后4月内',cwbbjdqx:'Y01_120'
        }
      });

      let fetch_dzjk = async (year, lbzt) => {
        let result = [];
        let ret = await this.httpPost('http://www.jsds.gov.cn/QykkxxCxAction.do', {
          qs: {'sessionId':loginJson.data.sessionId},
          form: {
            sbrqq:`${year}-01-01`,sbrqz:`${year}-12-31`,kkrqq:'',kkrqz:'',lbzt,
            errorMessage:'',sucessMsg:'',handleDesc:'扣款数据查询',handleCode:'queryData',
            cqSb:'0',sessionId:loginJson.data.sessionId
          }
        });

        if(ret.body){
          let $ = cheerio.load(ret.body);
          result = _.map($('#queryTb tr').toArray().slice(1), o=>{
            let $td = $('td', o);
            return {
              sbblx: _.trim($td.eq(1).text()),
              sbrq: _.trim($td.eq(2).text()),
              skhj: _.trim($td.eq(3).text()),
              jkfs: _.trim($td.eq(4).text()),
              sbfs: _.trim($td.eq(5).text()),
              kkrq: _.trim($td.eq(6).text()),
              rkrq: _.trim($td.eq(7).text()),
            }
          });
        }

        return result;
      };

      let dzjk = [...(await fetch_dzjk('2016', '1')), ...(await fetch_dzjk('2016', '2'))];

      console.log(dzjk);

      if(base.name){
        let company = await this.model('company').where({name:base.name}).find();
        let company_id;
        if(think.isEmpty(company)){
          company_id = await this.model('company').add({name:base.name});
        }else{
          company_id = company.id;
        }

        let check_id = await this.model('company_check').add({
          create_time: moment().unix(),
          company_id,from:'江苏地税',
          auth_info:JSON.stringify({username, password}),
          format_text:JSON.stringify({base, level:[{
            stage:'2016',
            d1:_.sumBy(_.map(dzjk, 'skhj'), parseFloat).toFixed(2), d1_list: _.map(dzjk, o=>({
              name: o.sbblx, time: o.kkrq, money: o.skhj
            }))
          }]})
        })
      }





      return this.success();
    }
    else{
      return this.display();
    }
  }

  async captchaAction(){
    let httpClient = await this.getOrCreateHttpClient();

    let stream = httpClient.get('http://www.jsds.gov.cn/index/fujia2.jsp');
    stream = gm(stream).operator('gray', 'threshold', 50, true).stream();
    stream.pipe(fs.createWriteStream('code.jpg'));
    stream.on('end', ()=>{
      tesseract.process('code.jpg', (err, text)=>{
        text = _.trim(text);
        this.http.res.setHeader('Set-Cookie',`jsds_captcha=${text}`);
        fs.createReadStream('code.jpg').pipe(this.http.res);
      });
    })

  }

  async showAction(){
    let data = await this.fetch();
    this.assign(data);
    //this.model('company').add({id:info.nsrsbh, name:info.nsrmc, type:'jsgs',info,swdjxx,tzfxx,skjn, skjn_hj, grid });

    return this.display();
  }

  async fetch(){


    return {};
  }
}
