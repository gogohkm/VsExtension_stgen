AutoCAD (오토캐드) 명령어 총정리는 크게 그리기 명령어, 편집/수정 명령어, 기타 명령어, 이렇게 3가지로 나뉘어 있습니다. 

* DRAW ( 그리기 ) 

1. 좌표 ( 절대좌표, 상대좌표, 상대극좌표 )
   ① 절대좌표 : 원점을(0,0) 기준으로 좌표값 적용 ( 사용법 : X,Y , ex : 8,5 )
   ② 상대좌표 : 현재(임의의 지점) 좌표값이 원점과 같은 역할을 함 ( 사용법 : @X,Y , ex : @8,5 )
   ③ 상대극좌표 : 현재(임의의 지점) 좌표값이 원점과 같은 역할을 하나 각도를 사용함 ( 사용법 : @거리<각도 , ex : @10<45 )
 
2. LINE ( L ) : 선 그리기
       ① LINE From point : 0,0 [Enter]( 절대좌표 0,0에서 시작 )
       ② To point : @5,5 [Enter] ( 다음 점의 좌표가 앞의 좌표기준점에서 X방향으로 5, Y방향으로 5 나아감 )
       ③ To point : @5<90 [Enter]( 다음 점의 좌표가 앞의 좌표기준점에서 나아갈 거리5 각도 90도 방향 )
 
3. RECTANGLE ( REC ) : 사각형 그리기
   사각형의 대각선 방향의 좌표를 입력하여 사각형을 그림
       ① : 0,0 [Enter]
       ② Other corner : @420,297 [Enter]( A3 용지크기의 사각형을 그림 )
 
4. XLINE ( XL ) : 양방향 무한선 그리기
XLINE은 양뱡향으로 나가아는 무한한 선을 그린다
RAY는 단방향 무한선 그리기임. 
     ① XLINE Hor/Ver/Ang/Bisect/Offset/:
           Hor (수평)
           Ver (수직)
           Ang (각도)
           Bisect (이등분)
           Offset (간격)

5. CIRCLE ( C ) : 원 그리기
   CIRCLE 3P/2P/TTR/ :
         Diameter (지름)
         Radius (반지름)
         3P(세점을 지나는 원)
         2P(두점을 지나는 원)
         TTR(두선을 접하는 반지름이 XX인 원)
         TTT(세선을 접하는 원)

6. ARC ( A ) : 호 그리기
반시계 방향으로만 호 가 그려짐 (3p는 제외)
        3POINT (3점을 지나는 호)
        S,E,C (시작점, 중심점, 끝점)
        S,C,A (시작점, 중심점, 사이각)
        S,C,L (시작점, 중심점, 현의 길이)
        S,E,A (시작점, 끝점, 사이각)
        S,E,R (시작점, 끝점, 반지름)
        S,E,D (시작점, 끝점, 방향)
        C,S,E (중심점, 시작점, 끝점)
        C,S,A (중심점, 시작점, 사이각)
        C,S,L (중심점, 시작점, 현의 길이)
        CONTINUS (마지막 호에서 연속되는 호)
 
7. POLYLINE ( PLINE , PL ) : 두께를 가진 연결선 그리기
   하나의 선으로 연결된 객체를 그릴 수 있음 
   Pline 보다는 Line을 그려 Pedit 명령으로 Join 명령으로 객체를 연결하여 더많이 사용함 
   Pedit는 아래 Modify를 참고하세요^^ 
        ① From point:
        ② Current line-width is 0.0000
        ③ Arc/Close/Halfwidth/Length/Undo/Width/: 선을그릴 자표입력 또는 클릭
            Arc(A) : 호
            Close(C) : 닫기
            Halfwidth(H) : 반폭
            Length(L) : 길이
            Undo(U) : 취소
            Width(W) : 폭
                             : 선의 끝점
 
   Arc/Close/Halfwidth/Length/Undo/Width/: w [Enter]w 명령사용시
        ① Starting width <0.0000> : 폴리선의 시작폭(선의 굵기)입력 [Enter]
        ② Ending width <0.0000> : 폴리선의 끝폭(선의 굵기)입력 [Enter]
        :삼각형과 같은 화살표의 끝도 Drawing 가능
 
8. POLYGON ( POL ) : 다각형 그리기
        ① POLYGON Number of sides <4> : 다각형의 변의 수 입력 [Enter]
        ② Edge/ : E 한변을 기준으로 할것인가 또는
        ③ First endpoint of edge : 한변의 끝점 입력 [Enter]
        ④ econd endpoint of edge : 다른 한쪽점 입력 [Enter]

  원의 내접(I), 외접(C) 반경지정
        ② Edge/ : C 중심점을 기준으로 할것인가  [Enter]
        ③ Inscribed in circle/Circumscribed about circle (I/C) : 내접(I) 또는 외접(C) [Enter]
        ④ Radius of circle : 원의 반지름 입력 [Enter]
 
9. DONUT( DO ) : 도우넛 그리기
        ① Inside diameter <10.0000> : 도우넛의 안지름 입력 [Enter]
        ② Outside diameter <20.0000> : 도우넛의 바깥지름 입력 [Enter]
        ③ Center of doughnut : 중심점 입력 [Enter]
※참고 : FILL 사용으로 도우넛 내부 채우기 또는 비우기 속성 지정가능

10. SPLINE ( SPL ) : 자유곡선 그리기
    물체의 단면을 표시하는 파단선 그리기에 사용함
        ① Object/: 자유곡선을 그릴 첫점 선택 [Enter]
        ② Enter point : 다음점 선택 [Enter]계속반복~
※참고 : 곡선이므로 [F8] 키는 OFF 상태로해야함
    선택점마다 곡선이됨 마지막에 [Enter]세 번을 눌러가 곡선 그리기가 마무리 됨

11. ELLIPSE ( EL ) : 타원 그리기
    Arc/Center/:
        Arc(A) : 호
        Center(C) : 중심 
            ① : 한쪽 끝점 선택 [Enter] 
            ② : 다른쪽 끝점 선택 [Enter] 
            ③ /Rotation : 또다른 한점 선택(높이) [Enter]
Rotation : 두점을 기준으로 돌릴 각도 입력도 가능함

12. HATCH ( H ) : 해칭하기
    물체의 단면을 표시할 때 사용함

    Pattern: 해칭 형식
    Pick Points: 닫혀진 영역을 지정 - 마우스 왼쪽 클릭 (모니터 화면상에 영역이 다보여야 지정됨)
                          뚫려있으면 해칭이 안됨 (다른부분까지 해칭 되버림)
    Select Objects : 형 해칭시, 해칭할 경계를 하나하나의 개체로 선택
    Remove Islands : Pick Points로 정의된 경계선중 불필요한 경계 제거
    View Selections : 지정한 해칭 경계선 확인
    Advancde : 경계에 대한 정보
        ∴Island Detection : 해칭 경계 영역 자동으로 지우기
        ∴Retain Boundaries : 해칭 경계 영역 남기기
    Inherit Properites : 기존 해칭의 특성 이어받기
    Preview Hacth: 해칭 미리보기
    Scale: 해칭 축척(적당히 보면서 조절하세요)
    Angle: 각도(현재 Pattern에서 보이는 각이 0도임)
    Explode : 해칭 분해하기(거의 분해할일없음)
    해칭 수정하기 : HATCHEDIT ( HE ) 사용 방법은 해칭하기와 동일함 (수정할 해징을 선택하면됨)
 
13. TRACE(단축명령없음) : 두께선
    두께를 가진 선 FILL 명령으로 속을 채우고 비우고가 가능함 (도우넛과 동일) / 사용법은 Line과동일
        ① Trace width <1.0000> : 폭지정 [Enter]
          ② From point : 시작점 입력 [Enter]
          ③ To point : 다음점 입력 [Enter]
     ④ To point : ⇐ Line 명령과 동일함
 
14. SOLID ( SO ) : 삼각형 사각형 속 채우기
    FILL 명령으로 속을 채우고 비우고가 가능함
    Pline로 그린 삼각형과는 약간다름 Pline은 삼각형의 세점이 선택 되지 않는 반면 Solid는 모든
    점이 선택 수정 가능함

        First point : 채우고자하는 첫 번째 점 입력
        Second point : 두 번째 점 입력
        Third point : 세 번째점 입력
        Fourth point : 삼각형 그릴때
        Fourth point : 네 번째점 입력시 사각형의 자동으로속이 채워짐
※참고 : 찍는점의 순서 유의할 것(사각형이 꼬임) 한번 해보시면 압니다^^

15. MTEXT ( MT, T ) : 문자 쓰기
    문자를쓸 영영을 대각선 방향으로 마우스로 클릭하면됨
    문자가 선택한 영역안에 들어감
    글꼴(폰트)을 미리 만들 필요가 없으며 한글, 영문 작성이 자유로움, 미리 작성된 문서를 불러 올 수 있으며 검색 치환기능이 있음

16. DTEXT ( DT ) : 동적 문자쓰기
    문자를 입력하기전에 미리 문자 STYLE을 만들어야함 (한글 사용시 필수)
    글을 쓰는 중간에도 다른 지점에 문자를 기입할수 있음
        ① DTEXT Justify/Style/: 문자를 입력할 지점을 선택 [Enter]
        ② Height <2.5000> : 문자크기 입력 [Enter]
        ③ Rotation angle <0> : 문자의 회전 각도 입력 [Enter]
        ④ Text : 문자 입력 [Enter](반 복가능)
※ 입력후 [Enter]를 한번더 눌러서 문자를 입력해야함 [Esc]키를 누르면 입력한 문자가 날라가버림
    다시 작성해야함~ 반드시 엔터를 한번더 눌러야함^^

17. LAYER ( LA ) : 층
        New : 새로운 층을 만듬
        Current : 현재의 층으로 지정
        Color : 색상 지정
        Ltype : 선종류 지정

  

Layer 이름
색상(Color)
선종류(Linetype)	비고
0
흰색(7번)
Continuous
테두리선,표제란 외 지정 되지않은 것
Center	녹색(3번)	Center2	중심선
Dim	빨간색(1번)	Continuous	치수선,치수보조선,치수문
Hidden	노란색(2번)	Hdden2	은선(숨은선)
Model	흰색(7번)	Continuous	외형선
Mview	하늘색(4번)	Continuous	Mview 창


* MODIFY ( 편집, 수정 명령 )

1. COPY ( CO , CP ) : 복사하기
        ① Select objects : 복사할 대상물 선 택하기
        ② /Multiple : 복사할 물체의 기준점 선택 / 다중 복사
        ③ Second point of displacement : 붙혀 넣을 기준점 선택

2. MOVE ( M ) : 이동하기
        ① Select objects : 이동할 대상물 선 택하기
        ② Base point or displacement : 이동할 물체의 기준점 선택
        ③ Second point of displacement : 이동될 기준점 선택
 
3. ERASR ( E ) : 지우기
    지울 대상물을 선택한후 E 누르고 확인키를 누르면 대상물이 지워짐

4. TRIM ( TR ) : 잘라내기
        ① Select cutting edges : (Projmode = UCS, Edgemode = Extend)
        ② Select objects : 자를 경계 선택 [Enter]
* 경계를 선택하지 않고 [Enter]를 한번더 누르면 모든 경계를 기준으로 잘라짐

5. EXTEND ( EX ) : 연장하기
        ① Select boundary edges : (Projmode = UCS, Edgemode = Extend)
        ② Select objects : 연장될 경계선 선택 [Enter]
* 경계를 선택하지 않고 [Enter]를 한번더 누르면 모든 경계를 기준으로 연장됨

6. OFFSET ( O ) : 평행 복사
    일정 간격으로 평행 복사를 함
        ① Offset distance or Through <1.0000> : 10 [Enter]평 행 복사할 간격을 지정
        ② Select object to offset : 평행 복사할 대상물 선택
        ③ Side to offset? : 평행 복사할 위치 선택 (마우스로 평행 복사할 위치를 적당히 클릭)

7. FILLET ( F ) : 라운딩
        ① (TRIM mode) Current fillet radius = 10.0000 <= 현재 설정된 내용이 보임
                Polyline/Radius/Trim/[Enter]라 운딩할 반지름 변경
        ② Enter fillet radius <10.0000> : 20 [Enter]
        ③ Command : F [Enter]반 지름을 변경하면 명령어가 종료되므로 다시 한번 F
        ④ (TRIM mode) Current fillet radius = 20.0000 <= 변경된 내용이 보임
                Polyline/Radius/Trim/
        ⑤ Select second object : 나머지 한쪽 선택
                ㉠ (TRIM mode) Current fillet radius = 20.0000
                       Polyline/Radius/Trim/[Enter]경계선 절단 여부 선택
                ㉡ Trim/No trim : N [Enter]현제 설정값이 경계선을 절단하면서 라운딩함 => 절단안함(N)
                ㉢ Polyline/Radius/Trim/
                ㉣ Select second object : 나머지 한쪽 선택

8. CHAMFER ( CHA ) : 모따기
    FILLET 명령어와 비슷함(CHAMFER 안의 TRIM 명령 설명은 생략)
        ① (TRIM mode) Current chamfer Dist1 = 10.0000, Dist2 = 10.0000 <= 현재 설정된 내용이 보임
                Polyline/Distance/Angle/Trim/Method/[Enter]모따기할 길이 변경
        ② Enter first chamfer distance <10.0000> : 20 [Enter]
        ③ Enter second chamfer distance <20.0000> : 20 [Enter]
        ④ Command : CHA [Enter]길 이를 변경하면 명령어가 종료되므로 다시 한번 CHA
        ⑤ (TRIM mode) Current chamfer Dist1 = 20.0000, Dist2 = 20.0000 <= 변경된 내용이 보임
        ⑥ Polyline/Distance/Angle/Trim/Method/
        ⑦ Select second line : 나머지 한쪽 선택

9. ARRAY ( AR ) : 배열 복사
    R/P 두가지 명령이 있음. R 사각 배열, P 원형 배열

        ① Select objects : 배열복사할 대상물 선택 [Enter]
        ② Rectangular or Polar array (/P) : R [Enter]R 입력 <= 사각 배열 명령
        ③ Number of rows (---) <1> : 5 [Enter]Y 축에 연관되어 배열된 줄수
        ④ Number of columns (|||) <1> : 5 [Enter]X 축에 연관되어 배열된 줄수
        ⑤ Unit cell or distance between rows (---) : -50 [Enter]Y 축으로 떨어질 줄간의 거리 입력
        ⑥ Distance between columns (|||) : 5 [Enter]X 축으로 떨어질 줄간의 거리 입력

        ① Select objects : 배열 복사할 대상물 선택 [Enter]
        ② Rectangular or Polar array (/P) : P [Enter]P 입력 <= 원형 배열 명령
        ③ Base/: 원형 배열될 중심점 선택
        ④ Number of items : 8 [Enter]배열될 개수 (자기 자신을 포함한 갯수임)
        ⑤ Angle to fill (+=ccw, -=cw) <360> : -180 [Enter]원 형 배열할 사이각 입력
        ⑥ Rotate objects as they are copied? : 마지막에 [Enter]한번더~

10. MIRROT ( MI ) : 대칭 복사
        ① Select objects : 대칭 복사할 대상물 선택 [Enter]
        ② First point of mirror line : 대칭 복사할 기준선의 한쪽끝 선택
        ③ Second point : 나머지 한쪽 기준점 선택
        ④ Delete old objects? : [Enter]대칭 복사할 원본 개체를 지우겠는냐는 물음임.
                                                             지우려면 Y를 입력(거의 지울일 없음)

11. LENGHEN ( LEN ) : 길이 조정

DElta/Percent/Total/DYnamic/[Enter]
        DE : 입력한거리가 늘어나는 길이임(길이를 입력후 대상물 선택)
        P : 현재 길이가 100%임, 50을 하면 선택한쪽이 절반으로 줄어듬
        T : 최종 남길 길이 입력
        DY : 마우스로 대충 길이 변경시 사용

DElta/Percent/Total/DYnamic/
    ex) Current length : 108.6574, Included angle : 57
    ex) 현재 길이<108.6574>, 사이각<57>

12. SCALE ( SC ) : 축척
    대상물을 일정한 크기로 확대 축소
        ① Select objects : 대상물 선택
        ② Base point : 기준점 선택
        ④ /Reference : 2 죽척 값입력

13. LINETYPE ( LT ) : 선종류
    처음 시작시에는 실선 밖에 없으며 사용할 선들을 불러와서 사용 하여야한다

        Load : 선 불러오기
        Current : 현재 사용하는 선으로 변경하기
        Global scale facter : 전체적인 선의 간격
        Current object scale : 현제선의 간격

14. LTSCALE ( LTS ) : 선간격 조절
    화면의 모든 요소의 선간격 조절, 각각의 조절은 CH 명령을 사용하여 조절해야함.

15. CHANGE PROPERTIS ( CH ) : 속성 바구기
      Color : 색상 변경
        Layer : 도면층 변경
        Linetype : 선종류 변경
        Linetype Scale : 선간격 변경
        ThickneSS : 두께 변경

16. DDEDIT ( ED ) : 문자편집
    선택한 문자 편집이 가능함 반복적으로 여러 문자 편집이 가능

17. PEDIT ( PE ) : 폴리라인 편집
        ① PEDIT Select polyline : 폴리선 선택(선을 선택) [Enter]
        ② Do you want to turn it into one? [Enter]
        ③ Close/Join/Width/Edit vertex/Fit/Spline/Decurve/Ltype gen/Undo/eXit : 편집명령입력[Enter] 

닫기(C)/연결(J)/폭(W)/정점편집 (E)/맞춤곡선(F)/곡 선(S)/비곡선화(D)/선간격(L)/명령취소(U)/나가기(X)
        여기서 Join 명령을 가장 많이 사용하므로 반드시 기억하시길
        3D에서도 JOIN을 모르면 3D를 그리기힘듬

18. BREAK ( BR ) : 절단
        ① BREAK Select object : 절단할 대상물 선택 [Enter]
        ② Enter second point (or F for first point) : 절단될 다른점 선택 [Enter]또 는 @ , F [Enter] 

 F : 절단될 첫점 다시지정 
@ : 선택한점이 절단됨
※원(Circle) 절단시는 반시계 방향으로 절단이됨

19. STRETCH ( S ) : 신축, 선늘리기
        늘릴 대상물과 연관된 부분까지 모두선택. 선택시 오른쪽에서 왼쪽으로 선택함 (선택 윈도우 코너)
        신축할 물체의 기준점 선택후 늘릴 방향 또는 거리 입력


* 기타 명령어

1. NEW:  새로운 도면으로 시작하기 (CAD 시작시와 동일한 화면)
2. SAVE:  저장하기 (기존에 정한 이름이 아니라 새이름으로 저장임)
3. QSAVE:  저장하기 (지정한 이름으로 저장하기)

4. OPEN:  불러오기 (기존에 저장되어 있는 도면을 불러옴)
5. QUIT:  빠져나가기 (캐드 프로그램을 종료함 Alt+[F4] 기능키와 동일한 기능임)
6. REDRAW ( R ):  다시 그리기
    화면에 보이는 지저분한 점들을 없애줌(선은 안 없어짐)

7. REGEN ( RE ): 도면 재생성 
   오래 도면을 그리다 보면 원이 각이져 보이는데 이때 원을 다시 원으로 보이게함
   도면의 정보를 다시 읽어들여 새로 생성시키는 역할을 함
8. UNDO( U ): 취소 명령 ( 되돌리기 )
    실행했던 명령어를 뒤루 돌림, 반복적으로 뒤루 계속 돌아감.
9. REDO: 되살리기 
          U 명령으로 되돌린 물제를 되살림
          U 명령 다음에 사용가능 그런데 단 한번만 되돌리기가 가능함
          U 명령으로 여러번 되돌려 버리면 하나만 살아나고 나머진 되살리기 불가능함

10. CAL: 계산기
        ① Initializing...>> Expression‎!: ex) 4+5
                                  9 ⇒ 계산된 결과 치임


연 산 기 호	연 산	사 용 예
( )	그룹 연산	(5^2)+10 →52+2
^	지 수	10^5 →105
*, /	곱하기, 나누기	(20*3)/5
+, -	더하기, 빼기	(50+24)-(30+45)
sin(각도)	각도의 사인	sin(90)
cos(각도)	각도의 코사인	cos(45)
tan(각도)	각도의 탄젠트	tan(45)
asin(실수)	숫자의 아크사인	asin(0.123)
acos(실수)	숫자의 아크코사인	acos(0.123)
atan(실수)	숫자의 아크탄젠트	atan(1.0)
exp10(실수)	10의 지수	exp10(4)
sqrt(실수)	수식의 제곱근	sqrt(2)

11. DIST ( DI ): 거리 재기
        ① DIST First point : 잴물체의 한쪽끝점 입력 [Enter]
        ② Second point : 다른쪽 끝점 입력 [Enter]

Distance = 12.6432, Angle in XY Plane = 356, Angle from XY Plane = 0
Delta X = 12.6091, Delta Y = -0.9281, Delta Z = 0.0000
잰 물체의 거리 값이 나옴(Distance = 12.6432)

12. AREA: 면적 계산
    사각형이나 삼각형등 단순한 거리계산시 끝점을찍어서 면적을 계산함
        ① /Object/Add/Subtract : 시작점 임력 [Enter]
        ② Next point : 2번째점 입력 [Enter]
        ③ Next point : 세 번째점 입력 [Enter]
        ④ Next point : 네 번째점 입력 [Enter]
        ⑤ Next point : 마지각점 입력 [Enter] (처음 시작점과 동일한점 - 사각형이됨)
결과치 Area = 117.2765, Perimeter = 45.4673 ( Area = 117.2765 면적값임 )

복잡한 형태는 Pedit 명령으로 Join을한후 Object 명령을 사용함
닫혀진 물체여야 면적 계산이 가능...

Command : area [Enter]
/Object/Add(더하기) /Subtract(빼기) : o [Enter]
Select objects : 대상물 선택 [Enter]
Area = 117.2765, Perimeter = 45.4673
 

13. SAVETIME : 자동저장시간설정
    시스템 다운으로 현제 작업한 도면이 날아가버리는 수가 있으므로 적당한 시간으로 설정이 필요함
    자동 저장 시간 설정 LT 시험시 10분으로 설정하라고 규정되어있음
    10분마다 저장되는 곳은 현재 주어진 파일이 아닌 다른곳에 다른이름으로 저장되므로 도면 작도시
    수시로 저장하는 것이 바람직함. (별루 믿을게 못됨)
 
        ① New value for SAVETIME <120> : 10【Enter】기본 설정값은 120분임
    *자동 저장 폴더 및 파일명 C: \WINDOWS \TEMP \auto1.sv$ 로 자동 저장되므로 시스템 다운시
    auto1.sv$ 파일을 auto1.dwg 파일로 이름을 바꾸어 사용 해야함
    (언제까지 그렸던게 저장되어있 는지 알수없음)
 
14. PICKBOX : 선 택 상 자
        ① New value for PICKBOX <5>: 선 택 상자의 크기를 입력【Enter】
            '5'가 적당한 크기일껍니다 사용자에 따라서 조정하세요(눈이 나쁘면 크게 하세요)
            너무 적으면 선택하기 힘듬니다^^
 
15. ZOOM ( Z ) : 화 면 확 대 축 소
    All/Center/Dynamic/Extents/Previous/Scale(X/XP)/Window/<Realtime> :
                   ① All         : LIMITS를 설정한 영역이나 LIMITS 영역을 벗어난 요소까지 화면에 나타난다
            ② Center      : 지정한 점을 중심으로 확대하거나 축소한다
            ③ Dynamic     : 동적인 방법, 도면 용량이 만을때 사용하면 효율적으로 부분 확대가 가능함
            ④ Extents     : 현재그려진 화면 안의 도면 요소를 중점적으로 화면에 확대
            ⑤ Previous    : ZOOM 실행 이전으로 되돌림
            ⑥ Scale(X/XP) : 원하는 비율로 확대 축소, X : 현재 보이는 크기에 대한 비율 적용
                                                    XP : 실제 크기에 대한 비율
            ⑦ Window : 선택 상자 안의 대상물을 부분 확대 시킴
            ⑧ Realtime : 실시간 확대 축소 마우스로 위로 드래그하면 확대 아래로 드래그하면 축소

16. PAN ( P ) : 화 면 이 동
    화면의 물제가 이동되는게 아니라 보이는 화면 전체가 이동하는 것이므로 좌표값에는 아무 변화가 없음
 
17. GRID ( F7 ) : 모 눈
    화면에 일정한 간격으로 점을 찍어 표시를해 줌.
    찍혀있는 점들은 프린트가 되지않으며 LIMITS 한계내에만 존재함
 
18. SNAP ( F9 ) : 스 냅
    마우스 포인트의 움직임을 일정 간격으로 움직일수있게 조절을 함

 